// The approved design's high-risk behaviours, through HTTP with an in-memory
// database. Writer doubles here are scripted and sometimes deliberately bad;
// none of this says anything about writing quality.

import { describe, it, expect, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { openDb, migrate, type Db } from '../server/db.js';
import { Service } from '../server/service.js';
import { createApp } from '../server/app.js';
import { StandInWriter } from '../server/engine/standin.js';
import { loadPack } from '../server/engine/pack.js';
import type { Writer, WriterRequest, SearchRequest } from '../server/engine/writer.js';

let db: Db, svc: Service, server: Server, base: string, cookie = '';
const auth = { password: 'pw', secret: 'test-secret', secure: false };

async function boot(writer: Writer | null, withPack = false) {
  db = await openDb(undefined);
  await migrate(db);
  svc = new Service(db, writer, withPack ? loadPack() : null);
  server = createApp(svc, auth, { writerLabel: 'test', writerLive: !!writer?.live }).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'pw' }) });
  cookie = r.headers.get('set-cookie')!.split(';')[0];
}
async function api(method: string, path: string, body?: unknown) {
  const r = await fetch(`${base}/api${path}`, { method, headers: { 'content-type': 'application/json', 'x-songroom': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
}
afterEach(async () => { await svc?.idle(); server?.close(); await db?.close(); });

async function firstIdea() {
  const n = await api('POST', '/springboard/next', { clientKey: 'n1' });
  expect(n.status).toBe(200);
  await svc.idle();
  const sb = (await api('GET', '/springboard')).body;
  expect(sb.current).toBeTruthy();
  return sb;
}

const LYRIC = '[Chorus]\nI kept coming home\nLike that was the same as staying\nYou were learning to let go\nI was practicing leaving';
async function songWith(text = LYRIC) {
  const { body } = await api('POST', '/songs', { title: 'Practicing', text });
  return (await api('GET', `/songs/${body.id}`)).body;
}
const text = (song: any) => song.sections.map((s: any) => (s.label ? `[${s.label}]\n` : '') + s.lines.map((l: any) => l.text).join('\n')).join('\n\n');

describe('springboard', () => {
  it('shows one idea at a time from a batch, with a stable palette, and refresh never generates', async () => {
    await boot(new StandInWriter());
    const sb = await firstIdea();
    expect(sb.current.palette).toBe('ochre');
    expect(sb.current.title_parts.join(' ')).toBe(sb.current.title);
    expect(sb.queued).toBe(2);
    const runsBefore = (await api('GET', '/receipts')).body.length;
    await api('GET', '/springboard'); await api('GET', '/springboard');
    expect((await api('GET', '/receipts')).body.length).toBe(runsBefore);
    // Another idea comes from the queue without a new request
    const second = (await api('POST', '/springboard/next', { clientKey: 'n2' })).body;
    expect(second.shown).toBe(true);
    expect(second.current.id).not.toBe(sb.current.id);
    expect(second.current.palette).toBe('sage');
    expect(second.prevId).toBe(sb.current.id);
    // Previous restores the exact idea, palette unchanged
    const back = (await api('POST', '/springboard/current', { ideaId: sb.current.id })).body;
    expect(back.current.palette).toBe('ochre');
    expect(back.nextId).toBe(second.current.id);
  });

  it('a line he types becomes the idea exactly, with no writer call and no duplicate on a double tap', async () => {
    await boot(new StandInWriter());
    const typed = 'Half a line about  the ferry\n\n  and the second one ';
    const a = await api('POST', '/springboard/own', { text: typed, clientKey: 'own1' });
    const b = await api('POST', '/springboard/own', { text: typed, clientKey: 'own1' });
    expect(a.status).toBe(200); expect(b.status).toBe(200);
    expect(a.body.current.id).toBe(b.body.current.id);
    expect(a.body.current.lines.map((l: any) => l.text)).toEqual(['Half a line about  the ferry', '  and the second one']);
    expect(a.body.current.saved).toBe(false);
    expect((await api('GET', '/receipts')).body.length).toBe(0);
    expect((await api('POST', '/springboard/own', { text: '  \n ' })).status).toBe(400);
  });

  it('double taps send one paid request', async () => {
    await boot(new StandInWriter());
    const [a, b] = await Promise.all([api('POST', '/springboard/next', { clientKey: 'x1' }), api('POST', '/springboard/next', { clientKey: 'x2' })]);
    await svc.idle();
    expect(a.body.runId ?? b.body.runId).toBeTruthy();
    const runs = (await api('GET', '/receipts')).body.filter((r: any) => r.task === 'spark');
    expect(runs.length).toBe(1);
  });

  it('a late batch does not replace an idea he moved to meanwhile', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    class Slow extends StandInWriter { async write(req: WriterRequest) { await gate; return super.write(req); } }
    await boot(new Slow());
    const sb = await firstIdeaFast();
    async function firstIdeaFast() { release(); return firstIdea(); }
    // Use up the queue, then start a new batch and move back while it runs.
    await api('POST', '/springboard/next', { clientKey: 'q1' });
    await api('POST', '/springboard/next', { clientKey: 'q2' });
    let hold!: () => void;
    const gate2 = new Promise<void>((r) => (hold = r));
    (svc as any).writer.write = async (req: WriterRequest) => { await gate2; return StandInWriter.prototype.write.call(svc.writer, req); };
    const start = await api('POST', '/springboard/next', { clientKey: 'q3' });
    expect(start.body.runId).toBeTruthy();
    await api('POST', '/springboard/current', { ideaId: sb.current.id });
    hold();
    await svc.idle();
    const after = (await api('GET', '/springboard')).body;
    expect(after.current.id).toBe(sb.current.id);
    expect(after.queued).toBe(3);
  });

  it('changing direction discards unseen ideas from the old direction only', async () => {
    await boot(new StandInWriter());
    const sb = await firstIdea();
    const changed = (await api('PUT', '/springboard/direction', { text: 'modern pop, sharp' })).body;
    expect(changed.queued).toBe(0);
    expect(changed.current.id).toBe(sb.current.id); // the idea on screen is untouched
  });
});

describe('fragments and saving', () => {
  it('stores exactly what he typed, saves independently, and never duplicates', async () => {
    await boot(new StandInWriter());
    const sb = await firstIdea();
    const raw = '  am I your person\n   or just who’s awake?  ';
    const f1 = await api('POST', '/fragments', { ideaId: sb.current.id, text: raw, clientKey: 'f1' });
    const f1b = await api('POST', '/fragments', { ideaId: sb.current.id, text: raw, clientKey: 'f1' });
    expect(f1.body.id).toBe(f1b.body.id);
    expect(f1.body.text).toBe(raw);
    expect((await api('POST', '/fragments', { ideaId: sb.current.id, text: '   \n ' })).status).toBe(400);
    // Save just the fragment: Journal shows it, the idea stays unsaved
    await api('PATCH', `/fragments/${f1.body.id}`, { saved: true });
    await api('PATCH', `/fragments/${f1.body.id}`, { saved: true });
    let j = (await api('GET', '/journal')).body.entries;
    expect(j.filter((e: any) => e.type === 'fragment').length).toBe(1);
    expect(j.filter((e: any) => e.type === 'idea').length).toBe(0);
    expect(j[0].text).toBe(raw);
    expect(j[0].parent.id).toBe(sb.current.id);
    // Save the idea twice: one entry; the fragment is not copied
    await api('PATCH', `/ideas/${sb.current.id}`, { saved: true });
    await api('PATCH', `/ideas/${sb.current.id}`, { saved: true });
    j = (await api('GET', '/journal')).body.entries;
    expect(j.filter((e: any) => e.type === 'idea').length).toBe(1);
    expect(j.filter((e: any) => e.type === 'fragment').length).toBe(1);
  });

  it('pending composer text survives moving between ideas', async () => {
    await boot(new StandInWriter());
    const sb = await firstIdea();
    await api('PATCH', `/ideas/${sb.current.id}`, { pending: 'half a line…\nsecond' });
    const next = (await api('POST', '/springboard/next', { clientKey: 'p2' })).body;
    expect(next.current.pending).toBe('');
    const back = (await api('POST', '/springboard/current', { ideaId: sb.current.id })).body;
    expect(back.current.pending).toBe('half a line…\nsecond');
  });
});

describe('start writing', () => {
  it('creates one linked draft; source material stays out of the lyric until added', async () => {
    await boot(new StandInWriter());
    const sb = await firstIdea();
    await api('POST', '/fragments', { ideaId: sb.current.id, text: 'a scrap', clientKey: 's1' });
    const [a, b] = await Promise.all([api('POST', `/ideas/${sb.current.id}/start`), api('POST', `/ideas/${sb.current.id}/start`)]);
    expect(a.body.songId).toBe(b.body.songId);
    const again = await api('POST', `/ideas/${sb.current.id}/start`);
    expect(again.body.songId).toBe(a.body.songId);
    const ws = (await api('GET', `/songs/${a.body.songId}`)).body;
    expect(ws.sections.length).toBe(0);
    expect(ws.palette).toBe(sb.current.palette);
    expect(ws.scraps.map((s: any) => s.text)).toEqual(['a scrap']);
    expect(ws.idea.lines.length).toBeGreaterThan(0);
    expect(ws.seedAdded).toBe(false);
    // Add to lyrics: once per tap, source scrap preserved
    const add = { baseRev: ws.current_rev, afterLineId: null, text: ws.idea.lines.map((l: any) => l.text).join('\n'), clientKey: 'add1', source: 'seed' };
    const r1 = await api('POST', `/songs/${ws.id}/add`, add);
    const r2 = await api('POST', `/songs/${ws.id}/add`, add);
    expect(r1.body.rev).toBe(r2.body.rev);
    const after = (await api('GET', `/songs/${ws.id}`)).body;
    expect(after.sections.flatMap((s: any) => s.lines).length).toBe(ws.idea.lines.length);
    expect(after.scraps.length).toBe(1);
    // live 10 Oct: the starting point still said "not yet in your lyrics" after it was added
    expect(after.seedAdded).toBe(true);
    const j = (await api('GET', '/journal?filter=songs')).body.entries;
    expect(j.map((e: any) => e.id)).toEqual([ws.id]);
  });
});

describe('one suggestion at a time', () => {
  it('browsing never changes the lyric; Keep changes only the authorised span', async () => {
    await boot(new StandInWriter());
    const song = await songWith();
    const before = text(song);
    const last = song.sections[0].lines[3];
    const s = await api('POST', `/songs/${song.id}/suggest`, { baseRev: song.current_rev, instruction: 'something sadder, keep the rhythm',
      targets: [{ kind: 'span', lineId: last.id, start: 17, end: 24, expected: 'leaving' }], clientKey: 'g1' });
    await svc.idle();
    const set = (await api('GET', `/suggestions/${s.body.setId}`)).body;
    expect(set.items.length).toBe(4);
    for (let i = 0; i < 4; i++) await api('GET', `/suggestions/${s.body.setId}`);
    expect(text((await api('GET', `/songs/${song.id}`)).body)).toBe(before);
    const k1 = await api('POST', `/songs/${song.id}/keep`, { setId: s.body.setId, index: 2, clientKey: 'k1' });
    const k2 = await api('POST', `/songs/${song.id}/keep`, { setId: s.body.setId, index: 2, clientKey: 'k1' });
    expect(k1.body.rev).toBe(k2.body.rev);
    const after = text((await api('GET', `/songs/${song.id}`)).body);
    expect(after).toBe(before.replace('I was practicing leaving', 'I was practicing [stand-in 3]'));
    // "keep the rhythm" carried into the context
    const ws = (await api('GET', `/songs/${song.id}`)).body;
    expect(ws.context.rhythm.sample).toBe('leaving');
    expect(ws.context.lastInstruction).toBe('something sadder, keep the rhythm');
  });

  it('a stale proposal cannot overwrite a line he edited since', async () => {
    await boot(new StandInWriter());
    const song = await songWith();
    const l2 = song.sections[0].lines[1];
    const s = await api('POST', `/songs/${song.id}/suggest`, { baseRev: 1, instruction: 'more bitter', targets: [{ kind: 'line', lineId: l2.id, expected: l2.text }], clientKey: 'st1' });
    await svc.idle();
    await api('PUT', `/songs/${song.id}/text`, { baseRev: 1, text: LYRIC.replace('Like that was the same as staying', 'Like that counted as staying') });
    const k = await api('POST', `/songs/${song.id}/keep`, { setId: s.body.setId, index: 0, clientKey: 'st2' });
    expect(k.status).toBe(409);
    expect(text((await api('GET', `/songs/${song.id}`)).body)).toContain('Like that counted as staying');
  });

  it('malformed model output never touches locked or surrounding text', async () => {
    const bad = (req: WriterRequest) => {
      const props = (req.schema as any).properties;
      if ('update' in props) return { note: '', update: { meaning: '', narrator: '' }, options: [
        { targets: [{ target: 'T1', text: 'I kept coming home\nand rewrote everything' }] },
        { targets: [{ target: 'T9', text: 'sneaky' }] },
        { targets: [{ target: 'T1', text: 'You were learning to let go' }, { target: 'T2', text: 'extra' }] },
        { targets: [{ target: 'T1', text: 'losing' }] } ] };
      return {};
    };
    await boot(new StandInWriter(bad));
    const song = await songWith();
    const [l1, , , l4] = song.sections[0].lines;
    await api('PATCH', `/songs/${song.id}`, { locks: [l1.id] });
    const locked = await api('POST', `/songs/${song.id}/suggest`, { baseRev: 1, instruction: 'x', targets: [{ kind: 'line', lineId: l1.id, expected: l1.text }], clientKey: 'm0' });
    expect(locked.status).toBe(409);
    const s = await api('POST', `/songs/${song.id}/suggest`, { baseRev: 1, instruction: 'another word', targets: [{ kind: 'span', lineId: l4.id, start: 17, end: 24, expected: 'leaving' }], clientKey: 'm1' });
    await svc.idle();
    const set = (await api('GET', `/suggestions/${s.body.setId}`)).body;
    expect(set.items.length).toBe(1); // only the well-formed option survives
    await api('POST', `/songs/${song.id}/keep`, { setId: s.body.setId, index: 0, clientKey: 'm2' });
    expect(text((await api('GET', `/songs/${song.id}`)).body)).toBe(LYRIC.replace('practicing leaving', 'practicing losing'));
  });

  it('Another passes earlier options on; a failed call leaves the lyric and the last batch intact', async () => {
    let calls: string[] = [];
    let fail = false;
    const script = (req: WriterRequest) => {
      calls.push(req.user);
      if (fail) throw new Error('boom');
      return { note: '', update: { meaning: 'he never saw it coming', narrator: '' }, options: [{ targets: [{ target: 'T1', text: `opt ${calls.length}` }] }] };
    };
    await boot(new StandInWriter(script));
    const song = await songWith();
    const l4 = song.sections[0].lines[3];
    const t = [{ kind: 'line', lineId: l4.id, expected: l4.text }];
    const a = await api('POST', `/songs/${song.id}/suggest`, { baseRev: 1, instruction: 'rhyme with home', targets: t, clientKey: 'a1' });
    await svc.idle();
    const b = await api('POST', `/songs/${song.id}/suggest`, { baseRev: 1, instruction: 'rhyme with home', targets: t, clientKey: 'a2', parentSetId: a.body.setId });
    await svc.idle();
    expect(calls[1]).toContain('Options he has already seen');
    expect(calls[1]).toContain('opt 1');
    expect(calls[1]).toContain('Rhyme target: land on a rhyme by sound with "home"');
    expect(calls[1]).toContain('he never saw it coming'); // meaning carried from the first answer
    fail = true;
    const c = await api('POST', `/songs/${song.id}/suggest`, { baseRev: 1, instruction: 'rhyme with home', targets: t, clientKey: 'a3', parentSetId: a.body.setId });
    await svc.idle();
    const failed = (await api('GET', `/suggestions/${c.body.setId}`)).body;
    expect(failed.status).toBe('failed');
    expect((await api('GET', `/suggestions/${b.body.setId}`)).body.items.length).toBe(1);
    expect(text((await api('GET', `/songs/${song.id}`)).body)).toBe(LYRIC);
  });

  it('literal replacements are direct and free', async () => {
    await boot(new StandInWriter());
    const song = await songWith("[Pre]\nQuit getting mad\n\n[Verse]\nI quit calling\n\n[Pre]\nQuit getting mad");
    const s = await api('POST', `/songs/${song.id}/suggest`, { baseRev: 1, instruction: "change 'Quit getting mad' to 'You stopped getting mad'", targets: [], clientKey: 'l1' });
    expect(s.body.runId).toBeNull();
    await api('POST', `/songs/${song.id}/keep`, { setId: s.body.setId, index: 0, clientKey: 'l2' });
    expect(text((await api('GET', `/songs/${song.id}`)).body)).toBe("[Pre]\nYou stopped getting mad\n\n[Verse]\nI quit calling\n\n[Pre]\nYou stopped getting mad");
  });

  it('a rhyme linked to a line follows it visibly; a fixed one never changes', async () => {
    await boot(new StandInWriter());
    const song = await songWith();
    const l3 = song.sections[0].lines[2];
    let ctx = (await api('PATCH', `/songs/${song.id}/context`, { rhyme: { lineId: l3.id } })).body;
    expect(ctx.rhyme).toMatchObject({ word: 'go', mode: 'linked' });
    await api('PUT', `/songs/${song.id}/text`, { baseRev: 1, text: LYRIC.replace('learning to let go', 'learning to be alone') });
    ctx = (await api('GET', `/songs/${song.id}`)).body.context;
    expect(ctx.rhyme.word).toBe('alone');
    expect(ctx.rhyme.notice).toEqual({ from: 'go', to: 'alone' });
    ctx = (await api('PATCH', `/songs/${song.id}/context`, { rhyme: { word: 'mode' } })).body;
    await api('PUT', `/songs/${song.id}/text`, { baseRev: 2, text: LYRIC });
    expect((await api('GET', `/songs/${song.id}`)).body.context.rhyme.word).toBe('mode');
  });
});

describe('references', () => {
  it('resolves ADÉLA from the research pack, accents ignored, and a correction removes it', async () => {
    await boot(new StandInWriter(), true);
    const r = (await api('POST', '/references/resolve', { query: 'Adela' })).body;
    expect(r.status).toBe('resolved');
    expect(r.name).toBe('ADÉLA');
    expect(r.identity).toContain('PRIMA');
    await api('PUT', '/springboard/direction', { text: 'pop', refId: r.id });
    expect((await api('GET', '/springboard')).body.reference.name).toBe('ADÉLA');
    await api('POST', `/references/${r.id}/reject`);
    const sb = (await api('GET', '/springboard')).body;
    expect(sb.direction.refId).toBeNull();
    expect(sb.reference).toBeNull();
  });

  it('says honestly when it cannot look something up, and keeps pasted text as text', async () => {
    await boot(new StandInWriter());
    const r = (await api('POST', '/references/resolve', { query: 'Some Unknown Artist' })).body;
    expect(r.status).toBe('unavailable');
    const p = (await api('POST', '/references/resolve', { query: 'line one\nline two' })).body;
    expect(p.status).toBe('text');
  });

  it('uses web search when available and offers choices when ambiguous', async () => {
    class Searching implements Writer {
      readonly live = true; readonly label = 'searching double';
      write(req: WriterRequest) { return new StandInWriter().write(req); }
      async search(_req: SearchRequest) {
        return { text: 'Here: {"status":"ambiguous","candidates":[{"name":"Adele","kind":"artist","identity":"British singer","characteristics":[]},{"name":"Adéla","kind":"artist","identity":"Slovak singer, PRIMA (2026)","characteristics":["dry humour"]}]}',
          sources: [{ url: 'https://example.com/a', title: 'A' }], usage: { inputTokens: 10, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 2 }, model: 'claude-opus-5-5', requestId: null };
      }
    }
    await boot(new Searching());
    const r = (await api('POST', '/references/resolve', { query: 'Adela Prima', clientKey: 'r1' })).body;
    expect(r.status).toBe('pending');
    await svc.idle();
    const done = (await api('GET', `/references/${r.id}`)).body;
    expect(done.status).toBe('ambiguous');
    expect(done.details.sources[0].url).toBe('https://example.com/a');
    const chosen = (await api('POST', `/references/${r.id}/choose`, { index: 1 })).body;
    expect(chosen.name).toBe('Adéla');
    const runs = (await api('GET', '/receipts')).body;
    expect(Number(runs[0].cost_usd)).toBeGreaterThanOrEqual(0.02); // two searches billed
  });
});

describe('preservation', () => {
  it('the backup includes experiments, fragments and suggestion sets', async () => {
    await boot(new StandInWriter());
    const r = await fetch(`${base}/api/export.json`, { headers: { cookie } });
    const b = await r.json();
    for (const t of ['experiments', 'fragments', 'suggestion_sets', 'refs', 'ideas', 'songs', 'song_revisions']) expect(Array.isArray(b[t])).toBe(true);
  });
});

describe('upgrading the live database', () => {
  it('migration 3 keeps every existing idea, song and experiment exactly as it was', async () => {
    const { MIGRATIONS } = await import('../server/db.js');
    const d = await openDb(undefined);
    await d.query(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT)`);
    for (let i = 0; i < 2; i++) for (const stmt of MIGRATIONS[i].split(/;\s*\n/).map((x) => x.trim()).filter(Boolean)) await d.query(stmt);
    await d.query(`INSERT INTO schema_migrations(version) VALUES (1),(2)`);
    await d.query(`INSERT INTO ideas(id, kind, title, lines, original) VALUES ('i_old','line','Getaway car','[{"id":"l_1","text":"Getaway car\\u2019s an Uber (obviously)"}]','{}')`);
    await d.query(`INSERT INTO songs(id, title) VALUES ('g_old','Old song')`);
    await d.query(`INSERT INTO song_revisions(song_id, rev, sections, source) VALUES ('g_old',1,'[{"id":"s1","label":"Chorus","lines":[{"id":"l9","text":"keep me"}]}]','created')`);
    await d.query(`INSERT INTO experiments(id, batch, brief_id, trial, vote) VALUES ('x_1','b','X1','{"positions":[]}','2')`);
    await migrate(d);
    const [idea] = await d.query<any>(`SELECT * FROM ideas WHERE id='i_old'`);
    expect(idea.saved).toBe(1);
    expect(['ochre', 'sage', 'blue']).toContain(idea.palette);
    expect(idea.lines[0].text).toBe('Getaway car’s an Uber (obviously)');
    const [rev] = await d.query<any>(`SELECT sections FROM song_revisions WHERE song_id='g_old'`);
    expect(rev.sections[0].lines[0].text).toBe('keep me');
    const [x] = await d.query<any>(`SELECT vote, trial FROM experiments WHERE id='x_1'`);
    expect(x.vote).toBe('2');
    await migrate(d); // idempotent
    await d.close();
  });
});

// Sam, 11 Oct, after using it: ideas too high-concept, one read as a teen novelty;
// ground subjects in what charts; a bigger New idea; react to an idea and have it
// reworked; a committed idea is a page whose lines tap into the draft.
describe('ideas grounded in the chart, rework and page lines (11 Oct)', () => {
  const sparkJson = (n = 3) => ({ note: '', ideas: Array.from({ length: n }, (_, i) => ({ title: `Title ${i}`, titleParts: [`Title ${i}`], concept: `c${i}`, lines: [`line ${i}a`, `line ${i}b`] })) });

  it('each idea in a batch gets its own subject from the chart mix, and the genre chip changes the mix', async () => {
    const users: string[] = [];
    await boot(new StandInWriter((req: WriterRequest) => { users.push(req.user); return sparkJson(); }));
    await firstIdea();
    expect(users[0]).toContain('Subjects for this batch');
    expect(users[0]).toMatch(/charted on Spotify US/);
    expect(users[0]).toContain('adult narrator');
    const ids = (await db.query<{ subject: string }>(`SELECT subject FROM ideas WHERE origin='spark'`)).map((r) => r.subject);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every(Boolean)).toBe(true);
    await api('PUT', '/springboard/direction', { genre: 'country' });
    await api('POST', '/springboard/next', { clientKey: 'c1' }); await svc.idle();
    expect(users.at(-1)).toMatch(/country songs that actually charted/);
    expect((await api('PUT', '/springboard/direction', { genre: 'polka' })).status).toBe(400);
    // the diary-pop lane (11 Oct research): its own mix and its own note; naming its writers in the direction picks it too
    await api('PUT', '/springboard/direction', { genre: 'diary_pop' });
    await api('POST', '/springboard/next', { clientKey: 'c2' }); await svc.idle();
    expect(users.at(-1)).toContain('diary-pop lane');
    expect(users.at(-1)).toContain('Not a mood: a situation');
    await api('PUT', '/springboard/direction', { genre: '', text: 'like Gracie Abrams, sharp and sad' });
    await api('POST', '/springboard/next', { clientKey: 'c3' }); await svc.idle();
    expect(users.at(-1)).toContain('diary-pop lane');
  });

  it('the next batch is fetched ahead when the queue runs out, without stealing the screen', async () => {
    let n = 0;
    await boot(new StandInWriter(() => { n++; return sparkJson(); }));
    const first = await firstIdea();
    await api('POST', '/springboard/next', { clientKey: 'x2' });
    const third = (await api('POST', '/springboard/next', { clientKey: 'x3' })).body; // the last queued one: starts the next batch
    await svc.idle();
    expect(n).toBe(2);
    const sb = (await api('GET', '/springboard')).body;
    expect(sb.current.id).toBe(third.current.id); // the batch fetched ahead waits in the queue
    expect(sb.queued).toBe(3);
    expect(sb.runId).toBe(null);
    expect(sb.current.id).not.toBe(first.current.id);
    const fourth = (await api('POST', '/springboard/next', { clientKey: 'x4' })).body;
    expect(fourth.shown).toBe(true); // instant, no wait
  });

  it('a rework keeps what he marked word for word, becomes the idea on screen, and Previous reaches the original', async () => {
    const users: string[] = [];
    let mode = 'spark';
    await boot(new StandInWriter((req: WriterRequest) => {
      users.push(req.user);
      if (mode === 'spark') return sparkJson();
      // a writer that drops the kept line and rewrites the kept title
      return { title: 'Something Else', titleParts: ['Something Else'], concept: 'more grown-up', lines: ['new one', 'new two'], note: '' };
    }));
    const sb = await firstIdea();
    const idea = sb.current;
    mode = 'rework';
    const r = await api('POST', `/ideas/${idea.id}/rework`, { feedback: 'love the title, more mature and sexier', keepTitle: true, keepLineIds: [idea.lines[1].id], clientKey: 'rw1' });
    const again = await api('POST', `/ideas/${idea.id}/rework`, { feedback: 'love the title, more mature and sexier', keepTitle: true, keepLineIds: [idea.lines[1].id], clientKey: 'rw1' });
    expect(again.body.runId).toBe(r.body.runId);
    await svc.idle();
    expect(users.at(-1)).toContain('love the title, more mature and sexier');
    expect(users.at(-1)).toContain(`the line "${idea.lines[1].text}", word for word`);
    const now = (await api('GET', '/springboard')).body;
    expect(now.current.id).not.toBe(idea.id);
    expect(now.current.title).toBe(idea.title);
    expect(now.current.lines.map((l: any) => l.text)).toContain(idea.lines[1].text);
    expect(now.current.lines.map((l: any) => l.text)).toContain('new one');
    expect(now.current.parent_id).toBe(idea.id);
    expect(now.current.feedback).toBe('love the title, more mature and sexier');
    expect(now.prevId).toBe(idea.id);
    expect((await api('GET', `/ideas/${idea.id}`)).body.title).toBe(idea.title); // the original is untouched
    expect((await api('POST', `/ideas/${idea.id}/rework`, {})).status).toBe(400);
  });

  it('"use for new ideas too" adds the note to the direction', async () => {
    await boot(new StandInWriter((req: WriterRequest) => ('titleParts' in ((req.schema as any).properties) && 'note' in (req.schema as any).properties
      ? { title: 'T', titleParts: ['T'], concept: 'c', lines: ['a'], note: '' } : sparkJson())));
    const sb = await firstIdea();
    await api('POST', `/ideas/${sb.current.id}/rework`, { feedback: 'more mature', applyToNew: true, clientKey: 'rw2' });
    await svc.idle();
    expect((await api('GET', '/springboard')).body.direction.text).toContain('more mature');
  });

  it('a page asks for more lines; they land on the page, not in the draft, and tap into the draft one at a time', async () => {
    const users: string[] = [];
    await boot(new StandInWriter((req: WriterRequest) => {
      users.push(req.user);
      if ('lines' in (req.schema as any).properties && Object.keys((req.schema as any).properties).length === 2) return { note: '', lines: ['page one', 'page two', 'page one'] };
      return sparkJson();
    }));
    const sb = await firstIdea();
    const { body: started } = await api('POST', `/ideas/${sb.current.id}/start`);
    const r = await api('POST', `/songs/${started.songId}/lines`, { ask: 'a sexier chorus line', clientKey: 'ml1' });
    expect(r.status).toBe(200);
    await svc.idle();
    expect(users.at(-1)).toContain('a sexier chorus line');
    let ws = (await api('GET', `/songs/${started.songId}`)).body;
    const fromWriter = ws.scraps.filter((f: any) => f.source === 'writer');
    expect(fromWriter.map((f: any) => f.text)).toEqual(['page one', 'page two']); // duplicates dropped
    expect(fromWriter[0].ask).toBe('a sexier chorus line');
    expect(ws.sections.length).toBe(0); // nothing enters the draft by itself
    // tap one line, then another: both go to the end of the draft, in one section
    const a1 = await api('POST', `/songs/${ws.id}/add`, { baseRev: ws.current_rev, afterLineId: null, text: 'page one', clientKey: 't1', source: 'scrap' });
    ws = (await api('GET', `/songs/${ws.id}`)).body;
    const last = ws.sections.at(-1).lines.at(-1).id;
    await api('POST', `/songs/${ws.id}/add`, { baseRev: a1.body.rev, afterLineId: last, text: 'page two', clientKey: 't2', source: 'scrap' });
    ws = (await api('GET', `/songs/${ws.id}`)).body;
    expect(text(ws)).toBe('page one\npage two');
  });
});
