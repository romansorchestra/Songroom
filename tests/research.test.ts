// The 19 Oct 2026 research commission, Phases A and B: the versioned pack, the one research
// boundary every writing route goes through, the per-route experiment switch, and several
// references typed at once. These are FIXTURE traces with the stand-in writer: they prove the
// selected records reach the prompt, not that the writing is any better.

import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { openDb, migrate, type Db } from '../server/db.js';
import { Service } from '../server/service.js';
import { createApp } from '../server/app.js';
import { Studio } from '../server/studio.js';
import { StandInWriter } from '../server/engine/standin.js';
import { loadPack, latest, selectForRoute, selectPack, ROUTES, type Route } from '../server/engine/pack.js';
import { splitReference } from '../server/engine/refsplit.js';
import type { Writer, WriterRequest, SearchRequest } from '../server/engine/writer.js';

const pack = loadPack(path.resolve(process.cwd(), 'research', 'pack'))!;

describe('the versioned pack (pilot-1.2)', () => {
  it('uses the highest version of each record and keeps history in the files', () => {
    expect(pack.version).toBe('pilot-1.2');
    expect(pack.cards).toHaveLength(56);
    expect(pack.pairs).toHaveLength(16);
    expect(pack.profiles).toHaveLength(16);
    expect(new Set(pack.cards.map((c) => c.id)).size).toBe(56);
    for (const c of pack.cards) { expect(c.version).toBe(2); expect(c.applies_to).toMatch(/^(generator|session|both)$/); }
    const c45 = pack.cards.find((c) => c.id === 'C45')!;
    expect(c45.sources).not.toContain('CT-S41');
    const e07 = pack.pairs.find((p) => p.id === 'E07')!;
    expect(e07.version).toBe(2);
    expect(e07.analyst_view).toMatch(/^Analyst's view, not a correct answer/);
    for (const p of pack.profiles) expect(p.coverage, p.id).toBeTruthy();
  });

  it('latest() leaves out a record whose newest version is inactive, in file order', () => {
    const rows = [{ id: 'a', version: 1 }, { id: 'b', version: 1 }, { id: 'a', version: 2, active: false }, { id: 'b', version: 2 }];
    expect(latest(rows)).toEqual([{ id: 'b', version: 2 }]);
  });
});

describe('route selection', () => {
  const brief = { text: 'Replace the chorus hook with a plainer, conversational line that keeps the slant rhyme and the same rhythm; attitude, not a story' };
  it('never sends human co-writing advice to the generator, on any route or the legacy path', () => {
    const session = new Set(pack.cards.filter((c) => c.applies_to === 'session').map((c) => c.id));
    expect(session.size).toBeGreaterThan(0);
    for (const r of ROUTES) for (const c of selectForRoute(pack, r, brief).cards) expect(session.has(c.id), `${r} ${c.id}`).toBe(false);
    for (const t of ['ideas', 'lines', 'edit', 'draft'] as const) for (const c of selectPack(pack, { ...brief, task: t }).cards) expect(session.has(c.id)).toBe(false);
  });

  it('only cards labelled for the route, at most two, zero allowed, with a reason for each', () => {
    for (const r of ROUTES) {
      const sel = selectForRoute(pack, r, brief);
      expect(sel.cards.length).toBeLessThanOrEqual(2);
      for (const c of sel.cards) expect(c.routes).toContain(r);
      expect(sel.reasons.map((x) => x.id)).toEqual(sel.cards.map((c) => c.id));
      for (const x of sel.reasons) expect(x.score).toBeGreaterThanOrEqual(3);
      expect(selectForRoute(pack, r, brief, 0).cards).toEqual([]);
      expect(selectForRoute(pack, r, brief, 1).cards.length).toBeLessThanOrEqual(1);
    }
    expect(selectForRoute(pack, 'rewrite', brief).cards.length).toBeGreaterThan(0);
    expect(selectForRoute(pack, 'rewrite', { text: 'thanks' }).cards).toEqual([]);
  });
});

describe('several references typed at once', () => {
  const P = (q: string) => { const s = splitReference(q, pack.profiles); return { ids: s.profiles.map((p) => p.id), rest: s.rest }; };
  it('splits names the pack knows from the ones it must look up', () => {
    expect(P('Noah Kahan, Sam Fender')).toEqual({ ids: ['P16'], rest: ['Sam Fender'] });
    expect(P('Noah Kahan and Sam Fender')).toEqual({ ids: ['P16'], rest: ['Sam Fender'] });
    expect(P('Sam Fender & Noah Kahan')).toEqual({ ids: ['P16'], rest: ['Sam Fender'] });
    expect(P('Noah Kahan, Charli XCX')).toEqual({ ids: ['P16', 'P07'], rest: [] });
  });
  it('keeps one reference whole, including names and titles with commas in them', () => {
    expect(P('ADÉLA, Prima')).toEqual({ ids: ['P01'], rest: [] });
    expect(P('Adela')).toEqual({ ids: ['P01'], rest: [] });
    expect(P('Tyler, the Creator')).toEqual({ ids: ['P15'], rest: [] });
    expect(P('Good Luck, Babe!')).toEqual({ ids: ['P05'], rest: [] });
    expect(P('Espresso, Sabrina Carpenter')).toEqual({ ids: ['P03'], rest: [] });
    expect(P('something like Nashville')).toEqual({ ids: ['P13'], rest: [] });
    expect(P('Noah Kahan stick season era')).toEqual({ ids: ['P16'], rest: [] });
  });
  it('leaves anything the pack does not know to the lookup, whole', () => {
    expect(P('Sam Fender, Olivia Dean')).toEqual({ ids: [], rest: ['Sam Fender, Olivia Dean'] });
    expect(P('play it straight like early Taylor')).toEqual({ ids: [], rest: ['play it straight like early Taylor'] });
    expect(P('Crosby, Stills & Nash')).toEqual({ ids: [], rest: ['Crosby, Stills & Nash'] });
  });
});

// ------------------------------------------------------------------ through HTTP
let db: Db, svc: Service, server: Server, base: string, cookie = '';
const auth = { password: 'pw', secret: 'test-secret', secure: false };
class Recording extends StandInWriter { calls: WriterRequest[] = []; async write(req: WriterRequest) { this.calls.push(req); return super.write(req); } }

async function boot(writer: Writer) {
  db = await openDb(undefined);
  await migrate(db);
  svc = new Service(db, writer, pack);
  server = createApp(svc, auth, { writerLabel: 'test', writerLive: writer.live }).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'pw' }) });
  cookie = r.headers.get('set-cookie')!.split(';')[0];
}
async function api(method: string, p: string, body?: unknown) {
  const r = await fetch(`${base}/api${p}`, { method, headers: { 'content-type': 'application/json', 'x-songroom': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
}
afterEach(async () => { await svc?.idle(); server?.close(); await db?.close(); });

const LYRIC = '[Verse]\nI kept the porch light on for you\nLike that was the same as staying\n\n[Chorus]\nYou were learning to let go\nI was practicing leaving';
async function lastRun(task: string) {
  const [r] = await db.query<{ request: any; prompt_version: string; model: string; effort: string }>(`SELECT request, prompt_version, model, effort FROM runs WHERE task=$1 ORDER BY rowid DESC LIMIT 1`, [task]);
  return r;
}

describe('every route through the one research boundary (fixture traces)', () => {
  it('with each route set to notes only, the selected cards reach that route’s prompt and the run records them', { timeout: 60000 }, async () => {
    const w = new Recording();
    await boot(w);
    const routes = Object.fromEntries(ROUTES.map((r) => [r, 'cards']));
    expect((await api('PATCH', '/settings', { researchRoutes: routes })).status).toBe(200);
    const brief = 'attitude, not a story: a plainer conversational hook that keeps the slant rhyme and the same rhythm';
    const traces: Array<{ route: Route; task: string }> = [];
    const check = async (route: Route, task: string) => {
      const run = await lastRun(task);
      const rec = run.request.pack;
      expect(rec, route).toMatchObject({ route, mode: 'cards', version: 'pilot-1.2', profiles: [], pair: null });
      expect(rec.cards.length, route).toBeGreaterThan(0);
      expect(rec.cards.length).toBeLessThanOrEqual(2);
      expect(rec.reasons.map((x: any) => x.id)).toEqual(rec.cards);
      expect(run.prompt_version).toContain('+cards');
      const sent = w.calls.find((c) => c.user.includes(rec.block));
      expect(sent, `${route}: block not in any prompt`).toBeTruthy();
      for (const id of rec.cards) expect(sent!.user).toContain(pack.cards.find((c) => c.id === id)!.problem);
      traces.push({ route, task });
    };

    await api('PUT', '/springboard/direction', { text: brief, refId: null });
    await api('POST', '/springboard/next', { clientKey: 'i1' }); await svc.idle();
    await check('ideas', 'spark');

    await api('POST', '/messages', { threadId: null, text: `Three alternative lines for the chorus: ${brief}`, clientKey: 'c1' }); await svc.idle();
    await check('create', 'write');

    const idea = (await api('GET', '/springboard')).body.current;
    await api('POST', `/ideas/${idea.id}/rework`, { feedback: `make the hook ${brief}`, clientKey: 'd1' }); await svc.idle();
    await check('develop', 'rework');

    const { body: made } = await api('POST', '/songs', { title: 'Porch', text: LYRIC });
    const song = (await api('GET', `/songs/${made.id}`)).body;
    const last = song.sections[1].lines[1];
    await api('POST', `/songs/${song.id}/suggest`, { baseRev: song.current_rev, instruction: brief, targets: [{ kind: 'line', lineId: last.id, expected: last.text }], clientKey: 'r1' }); await svc.idle();
    await check('rewrite', 'suggest');

    await api('POST', `/songs/${song.id}/suggest`, { baseRev: song.current_rev, instruction: `continue the chorus: ${brief}`, targets: [], afterLineId: last.id, clientKey: 'n1' }); await svc.idle();
    await check('continue', 'suggest');

    await api('POST', `/songs/${song.id}/titles`, { ask: `a title for the chorus hook: ${brief}`, clientKey: 't1' }); await svc.idle();
    await check('title', 'titles');

    expect(traces.map((t) => t.route)).toEqual(['ideas', 'create', 'develop', 'rewrite', 'continue', 'title']);

    // The hang never gets notes, whatever the switches say.
    const before = w.calls.length;
    const h = await api('POST', '/hangs', { title: 'chat', text: 'Speaker 1: I kept the porch light on for you all winter long\nSpeaker 2: that is a title right there honestly, a chorus hook with attitude' });
    expect(h.status).toBe(200);
    await svc.idle();
    const hc = w.calls.slice(before).find((c) => c.user.includes('Transcript:'));
    expect(hc).toBeTruthy();
    expect(hc!.user).not.toContain('Craft notes');
    expect(hc!.system).not.toContain('Craft notes');
  });

  it('“Off” sends nothing and still records what happened; defaults are unchanged (edits only)', { timeout: 30000 }, async () => {
    const w = new Recording();
    await boot(w);
    const { body: made } = await api('POST', '/songs', { title: 'Porch', text: LYRIC });
    const song = (await api('GET', `/songs/${made.id}`)).body;
    const last = song.sections[1].lines[1];
    const ask = { baseRev: song.current_rev, instruction: 'keep the slant rhyme and the same rhythm, plainer', targets: [{ kind: 'line', lineId: last.id, expected: last.text }] };
    // default: rewrite has notes (legacy 'edits' scope), Ideas has none
    await api('POST', `/songs/${song.id}/suggest`, { ...ask, clientKey: 'a' }); await svc.idle();
    expect((await lastRun('suggest')).request.pack).toMatchObject({ route: 'rewrite', mode: 'legacy' });
    await api('POST', '/springboard/next', { clientKey: 'i' }); await svc.idle();
    expect((await lastRun('spark')).request.pack).toBeNull();
    // off
    const pr = await api('PATCH', '/settings', { researchRoutes: { rewrite: 'off' } });
    expect(pr.body.researchRoutes).toEqual({ rewrite: 'off' });
    w.calls.length = 0;
    const sb = await api('POST', `/songs/${song.id}/suggest`, { ...ask, instruction: ask.instruction + ' again', clientKey: 'b' }); await svc.idle();
    expect(sb.status, JSON.stringify(sb.body)).toBe(200);
    const off = await lastRun('suggest');
    expect(off.request.pack).toMatchObject({ route: 'rewrite', mode: 'off', cards: [] });
    expect(off.prompt_version).not.toContain('+');
    expect(w.calls.every((c) => !c.user.includes('Craft notes'))).toBe(true);
    // and back to default
    await api('PATCH', '/settings', { researchRoutes: { rewrite: 'default' } });
    expect((await api('GET', '/status')).body.settings.researchRoutes).toEqual({});
    expect((await api('PATCH', '/settings', { researchRoutes: { hang: 'cards' } })).status).toBe(400);
    expect((await api('PATCH', '/settings', { researchMaxCards: 3 })).status).toBe(400);
  });

  it('a preview can be asked for either condition and saves nothing', { timeout: 30000 }, async () => {
    const w = new Recording();
    await boot(w);
    const text = 'breakup song with attitude and a hook-first title, not a story';
    await api('POST', '/springboard/preview', { text, research: 'cards', clientKey: 'p1' }); await svc.idle();
    const on = await lastRun('preview');
    expect(on.request.pack.mode).toBe('cards');
    expect(on.request.pack.cards.length).toBeGreaterThan(0);
    await api('POST', '/springboard/preview', { text, research: 'off', clientKey: 'p2' }); await svc.idle();
    expect((await lastRun('preview')).request.pack).toMatchObject({ mode: 'off', cards: [] });
    expect((await db.query(`SELECT count(*) AS n FROM ideas`))[0].n).toBe(0);
  });
});

describe('several references through the app', () => {
  it('“Noah Kahan, Sam Fender” keeps both, says which one it could not check, and each can be dropped', { timeout: 30000 }, async () => {
    await boot(new StandInWriter());
    const g = (await api('POST', '/references/resolve', { query: 'Noah Kahan, Sam Fender' })).body;
    expect(g.status).toBe('group');
    expect(g.members.map((m: any) => [m.status, m.name || m.query])).toEqual([['resolved', 'Noah Kahan (Stick Season)'], ['unavailable', 'Sam Fender']]);
    expect(g.members[0].details.coverage).toBeTruthy();
    // what he likes about each, optional and separate
    await api('PATCH', `/references/${g.members[1].id}`, { want: 'big honest choruses about home' });
    const refs = await new Studio(svc).refsForPrompt([g.id]);
    expect(refs.map((r: any) => r.name)).toEqual(['Noah Kahan (Stick Season)', 'Sam Fender']);
    expect(refs[0].coverage).toBeTruthy();
    expect(refs[1]).toMatchObject({ source: 'unverified', want: 'big honest choruses about home' });
    // Create sends the group by id: both entries, with characteristics, reach the writer
    const w = new Recording();
    (svc as any).writer = w;
    await api('POST', '/messages', { threadId: null, text: 'three ideas for a homecoming song', reference: 'Noah Kahan, Sam Fender', refId: g.id, clientKey: 'm1' }); await svc.idle();
    const u = w.calls.find((c) => c.user.includes('His request'))!.user;
    expect(u).toContain('Noah Kahan (Stick Season)');
    expect(u).toContain('Sam Fender: not verified');
    expect(u).toContain('Coverage: Rests on');
    expect(u).toContain(pack.profiles.find((p) => p.id === 'P16')!.characteristics[0].text.slice(0, 40));
    // dropping one leaves the other
    await api('POST', `/references/${g.members[1].id}/reject`);
    const after = (await api('GET', `/references/${g.id}`)).body;
    expect(after.members.map((m: any) => m.name)).toEqual(['Noah Kahan (Stick Season)']);
  });

  it('a lookup that finds several names makes each its own reference, and names the one it could not find', { timeout: 30000 }, async () => {
    class Searching extends StandInWriter {
      readonly live = true as any;
      async search(req: SearchRequest) {
        expect(req.user).toContain('more than one reference');
        return { text: '{"status":"several","unfound":["Olivia Deen"],"candidates":[{"name":"Sam Fender","kind":"artist","identity":"English singer-songwriter from North Shields","characteristics":["writes about his town"]}]}',
          sources: [{ url: 'https://example.com/a', title: 'A' }], usage: { inputTokens: 10, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 1 }, model: 'claude-opus-5-5', requestId: null };
      }
    }
    await boot(new Searching());
    const r = (await api('POST', '/references/resolve', { query: 'Sam Fender, Olivia Deen' })).body;
    await svc.idle();
    const g = (await api('GET', `/references/${r.id}`)).body;
    expect(g.status).toBe('group');
    expect(g.members.map((m: any) => [m.status, m.name || m.query])).toEqual([['resolved', 'Sam Fender'], ['not_found', 'Olivia Deen']]);
    expect((await lastRun('reference')).prompt_version).toBe('ref2');
  });
});
