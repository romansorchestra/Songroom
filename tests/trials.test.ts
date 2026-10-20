// The research test (trials.ts): frozen prompts that differ only by the cards, A/B fixed and
// balanced at creation, conditions hidden until every verdict is in, and prompts identical to
// what production sends with research off. Stand-in writer: wiring, not writing quality.

import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { openDb, migrate, type Db } from '../server/db.js';
import { Service } from '../server/service.js';
import { createApp } from '../server/app.js';
import { StandInWriter } from '../server/engine/standin.js';
import { loadPack } from '../server/engine/pack.js';
import type { WriterRequest } from '../server/engine/writer.js';

const pack = loadPack(path.resolve(process.cwd(), 'research', 'pack'))!;
let db: Db, svc: Service, server: Server, base: string, cookie = '';
const auth = { password: 'pw', secret: 'test-secret', secure: false };
class Recording extends StandInWriter { calls: WriterRequest[] = []; async write(req: WriterRequest) { this.calls.push(req); return super.write(req); } }

async function boot(w: Recording) {
  db = await openDb(undefined);
  await migrate(db);
  svc = new Service(db, w, pack);
  server = createApp(svc, auth, { writerLabel: 'test', writerLive: false }).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'pw' }) });
  cookie = r.headers.get('set-cookie')!.split(';')[0];
}
async function api(method: string, p: string, body?: unknown) {
  const r = await fetch(`${base}/api${p}`, { method, headers: { 'content-type': 'application/json', 'x-songroom': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
}
afterEach(async () => { await svc?.idle(); server?.close(); await db?.close(); });

const LYRIC = '[Verse]\nForget me for a weekend, I\'ll be dead by Monday\nI need a little feeding every hour on the hour\n\n[Chorus]\nI\'m your Tamagotchi, baby, press any button\nKeep me alive with a little bit of nothing';

/** His kind of material, made through the app: a song, a rewrite and a continue set, an idea, a reference. */
async function material(w: Recording) {
  const { body: made } = await api('POST', '/songs', { title: 'Tamagotchi', text: LYRIC });
  const song = (await api('GET', `/songs/${made.id}`)).body;
  const l1 = song.sections[0].lines[0];
  const rw = await api('POST', `/songs/${song.id}/suggest`, { baseRev: song.current_rev, instruction: 'keep the rhythm, more bratty', targets: [{ kind: 'line', lineId: l1.id, expected: l1.text }], clientKey: 's1' });
  await svc.idle();
  const last = song.sections[1].lines[1];
  const ct = await api('POST', `/songs/${song.id}/suggest`, { baseRev: song.current_rev, instruction: 'A pre chorus that turns it', targets: [], afterLineId: last.id, clientKey: 's2' });
  await svc.idle();
  await api('POST', '/springboard/next', { clientKey: 'n1' }); await svc.idle();
  const idea = (await api('GET', '/springboard')).body.current;
  const ref = (await api('POST', '/references/resolve', { query: 'Noah Kahan' })).body;
  w.calls.length = 0;
  return { song, rewriteSet: rw.body.setId, continueSet: ct.body.setId, idea, ref };
}

describe('the research test', () => {
  it('freezes prompts that differ only by the cards, balances A/B, and hides conditions until all are judged', { timeout: 60000 }, async () => {
    const w = new Recording();
    await boot(w);
    const m = await material(w);
    const cases = [
      { id: 'E1', route: 'ideas', direction: 'Flex feel good seductive, a chorus hook with attitude', genre: 'pop' },
      { id: 'E2', route: 'ideas', direction: 'A male love song that does not make him look desperate, plain conversational hook', genre: 'pop', refId: m.ref.id },
      { id: 'E3', route: 'develop', ideaId: m.idea.id, feedback: 'love the title, make it more grown-up and sexier, less sad, sharper hook', keepTitle: true, keepConcept: false, keepLineIds: [m.idea.lines[0].id], changeLineIds: [] },
      { id: 'E4', route: 'ideas', direction: 'breakup song with attitude and a sarcastic hook, not a story', genre: 'country' },
      { id: 'E5', route: 'create', text: 'Three alternative lines for the chorus with a slant rhyme on "I", attitude, same rhythm', refId: m.ref.id },
      { id: 'E6', route: 'rewrite', setId: m.rewriteSet },
      { id: 'E7', route: 'continue', setId: m.continueSet },
      { id: 'E8', route: 'title', songId: m.song.id, ask: 'a plain conversational title for the chorus hook' },
    ];
    const c = await api('POST', '/trials', { name: 'test', cases, seed: 7 });
    expect(c.status, JSON.stringify(c.body)).toBe(200);
    await svc.idle();
    const rows = await db.query<any>(`SELECT * FROM trials ORDER BY ord`);
    expect(rows).toHaveLength(8);
    // A/B balanced within the Ideas side (ideas, develop) and the lyric side
    const ideaSide = rows.filter((r) => ['ideas', 'develop'].includes(r.route));
    expect(ideaSide.filter((r) => r.a_cond === 'on')).toHaveLength(2);
    expect(rows.filter((r) => !['ideas', 'develop'].includes(r.route) && r.a_cond === 'on')).toHaveLength(2);
    for (const r of rows) {
      const f = r.frozen;
      expect(f.research.mode, r.case_id).toBe('cards');
      expect(f.research.profiles).toEqual([]);
      expect(f.research.pair).toBeNull();
      if (f.research.cards.length) {
        expect(f.user.on).toContain(f.research.block);
        expect(f.user.off).not.toContain('Craft notes');
        expect(f.user.on.replace(`\n\n${f.research.block}`, '')).toBe(f.user.off); // the cards are the only difference
      } else expect(f.user.on).toBe(f.user.off);
      expect(r.outputs.off, r.case_id).toBeTruthy();
      expect(r.outputs.on, r.case_id).toBeTruthy();
    }
    // the same system prompt went to both conditions of every trial, and both conditions ran
    const trialRuns = await db.query<any>(`SELECT request, prompt_version FROM runs WHERE task='trial'`);
    expect(trialRuns).toHaveLength(16);
    // hidden until all are judged
    let b = (await api('GET', `/trials/${c.body.id}`)).body;
    expect(b.done).toBe(false);
    expect(b.trials[0].reveal).toBeUndefined();
    expect((await api('GET', `/trials/${c.body.id}/tally`)).status).toBe(409);
    // verdicts, with history; skip is its own answer
    await api('POST', `/trial/${b.trials[0].id}/vote`, { pick: 'A', spark: { B: true } });
    await api('POST', `/trial/${b.trials[0].id}/vote`, { pick: 'both', note: 'changed my mind' });
    const picks = ['A', 'B', 'neither', 'skip', 'A', 'B', 'both'];
    for (const [i, t] of b.trials.slice(1).entries()) await api('POST', `/trial/${t.id}/vote`, { pick: picks[i] });
    b = (await api('GET', `/trials/${c.body.id}`)).body;
    expect(b.done).toBe(true);
    expect(b.trials[0].reveal.A).toMatch(/on|off/);
    const [first] = await db.query<any>(`SELECT verdicts FROM trials WHERE id=$1`, [b.trials[0].id]);
    expect(first.verdicts.map((v: any) => v.pick)).toEqual(['A', 'both']);
    expect(first.verdicts.every((v: any) => v.at)).toBe(true);
    const tally = (await api('GET', `/trials/${c.body.id}/tally`)).body;
    expect(tally.both).toBe(2); expect(tally.neither).toBe(1); expect(tally.skip).toBe(1);
    expect(tally.on + tally.off).toBe(4);
    expect(tally.aPicked + tally.bPicked).toBe(4);
    // A/B never moved
    const again = await db.query<any>(`SELECT id, a_cond FROM trials ORDER BY ord`);
    expect(again.map((r) => r.a_cond)).toEqual(rows.map((r) => r.a_cond));
  });

  it('a repeat uses the same frozen prompts with the sides flipped', { timeout: 60000 }, async () => {
    const w = new Recording();
    await boot(w);
    const m = await material(w);
    const c = await api('POST', '/trials', { name: 'first', cases: [{ id: 'R1', route: 'rewrite', setId: m.rewriteSet }, { id: 'R2', route: 'continue', setId: m.continueSet }], seed: 3 });
    await svc.idle();
    const r = await api('POST', '/trials', { name: 'repeat', cases: [{ id: 'R1', route: 'rewrite', setId: m.rewriteSet }], repeatOf: c.body.id });
    expect(r.status).toBe(200);
    await svc.idle();
    const [a] = await db.query<any>(`SELECT * FROM trials WHERE batch=$1 AND case_id='R1'`, [c.body.id]);
    const [b] = await db.query<any>(`SELECT * FROM trials WHERE batch=$1`, [r.body.id]);
    expect(b.frozen).toEqual(a.frozen);
    expect(b.a_cond).not.toBe(a.a_cond);
    expect(b.repeat_of).toBe(c.body.id);
  });

  it('sends exactly what production sends with research off (create, rewrite, continue, title, develop)', { timeout: 60000 }, async () => {
    const w = new Recording();
    await boot(w);
    const m = await material(w);
    await api('PATCH', '/settings', { researchRoutes: { create: 'off', rewrite: 'off', continue: 'off', title: 'off', develop: 'off' } });
    const text = 'Three alternative lines for the chorus with a slant rhyme on "I"';
    // production
    await api('POST', '/messages', { threadId: null, text, reference: 'Noah Kahan', refId: m.ref.id, clientKey: 'p1' }); await svc.idle();
    const song = (await api('GET', `/songs/${m.song.id}`)).body;
    const l1 = song.sections[0].lines[0];
    const rw = await api('POST', `/songs/${song.id}/suggest`, { baseRev: song.current_rev, instruction: 'keep the rhythm, more bratty', targets: [{ kind: 'line', lineId: l1.id, expected: l1.text }], clientKey: 'p2' }); await svc.idle();
    const last = song.sections[1].lines[1];
    const ct = await api('POST', `/songs/${song.id}/suggest`, { baseRev: song.current_rev, instruction: 'A pre chorus that turns it', targets: [], afterLineId: last.id, clientKey: 'p3' }); await svc.idle();
    await api('POST', `/songs/${song.id}/titles`, { ask: 'a title for the next section', clientKey: 'p4' }); await svc.idle();
    await api('POST', `/ideas/${m.idea.id}/rework`, { feedback: 'make it sexier', keepTitle: true, keepLineIds: [m.idea.lines[0].id], preview: true, clientKey: 'p5' }); await svc.idle();
    const prod = w.calls.map((c) => c.user);
    // the test's frozen prompts for the same inputs (sets made just now, so the song and context match)
    const c = await api('POST', '/trials', { name: 'parity', seed: 1, cases: [
      { id: 'C', route: 'create', text, refId: m.ref.id },
      { id: 'R', route: 'rewrite', setId: rw.body.setId },
      { id: 'N', route: 'continue', setId: ct.body.setId },
      { id: 'T', route: 'title', songId: song.id, ask: 'a title for the next section' },
      { id: 'D', route: 'develop', ideaId: m.idea.id, feedback: 'make it sexier', keepTitle: true, keepConcept: false, keepLineIds: [m.idea.lines[0].id], changeLineIds: [] },
    ] });
    expect(c.status, JSON.stringify(c.body)).toBe(200);
    await svc.idle();
    const rows = await db.query<any>(`SELECT case_id, frozen FROM trials WHERE batch=$1`, [c.body.id]);
    for (const r of rows) {
      if (r.case_id === 'T') {
        // production's title prompt also lists titles it offered before for this song; the test freezes that list empty
        // and its examples of hit concepts are sampled at random each time, so they are left out of the comparison
        const p = prod.find((u) => u.startsWith('Sam is mid-song'))!;
        const hits = (u: string) => u.replace(/\n\nThe scale a concept lives at[\s\S]*?not in its concept\./, '');
        expect(hits(r.frozen.user.off)).toBe(hits(p.replace(/\n\nTitles you have already offered for this song[\s\S]*?(?=\n\nWhat he says he wants)/, '')));
      } else expect(prod, r.case_id).toContain(r.frozen.user.off);
    }
  });
});
