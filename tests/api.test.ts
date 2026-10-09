// End-to-end through HTTP with an in-process database. The scripted writers
// here are test doubles that behave badly on purpose; none of this is a
// substitute for testing real writing on the live build.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { openDb, migrate, type Db } from '../server/db.js';
import { Service } from '../server/service.js';
import { createApp } from '../server/app.js';
import { StandInWriter } from '../server/engine/standin.js';
import type { Writer, WriterRequest } from '../server/engine/writer.js';

let db: Db, svc: Service, server: Server, base: string, cookie = '';
const auth = { password: 'pw', secret: 'test-secret', secure: false };

async function boot(writer: Writer | null) {
  db = await openDb(undefined);
  await migrate(db);
  svc = new Service(db, writer);
  const app = createApp(svc, auth, { writerLabel: 'test', writerLive: !!writer?.live });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'pw' }) });
  cookie = r.headers.get('set-cookie')!.split(';')[0];
}

async function api(method: string, path: string, body?: unknown) {
  const r = await fetch(`${base}/api${path}`, { method, headers: { 'content-type': 'application/json', 'x-songroom': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  return { status: r.status, body: j as any };
}

afterEach(async () => { await svc?.idle(); server?.close(); await db?.close(); });

const LYRIC = '[Chorus]\nI kept coming home\nLike that was the same as staying\nYou were learning to let go\nI was practicing leaving';

async function makeSong(text = LYRIC) {
  const { body } = await api('POST', '/songs', { title: 'Practicing', text });
  return (await api('GET', `/songs/${body.id}`)).body;
}

describe('access', () => {
  beforeEach(() => boot(new StandInWriter()));
  it('requires a session and the write header', async () => {
    expect((await fetch(`${base}/api/journal`)).status).toBe(401);
    const r = await fetch(`${base}/api/songs`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{}' });
    expect(r.status).toBe(403);
    const bad = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'nope' }) });
    expect(bad.status).toBe(401);
  });
});

describe('writing and saving', () => {
  beforeEach(() => boot(new StandInWriter()));
  it('generates ideas, and saving twice keeps one copy', async () => {
    const m = await api('POST', '/messages', { threadId: null, text: 'three ideas about leaving lights on', clientKey: 'k1' });
    expect(m.status).toBe(200);
    const again = await api('POST', '/messages', { threadId: null, text: 'three ideas about leaving lights on', clientKey: 'k1' });
    expect(again.body.runId).toBe(m.body.runId); // double submit → one run
    await svc.idle();
    const t = (await api('GET', `/threads/${m.body.threadId}`)).body;
    const reply = t.messages.find((x: any) => x.role === 'assistant');
    expect(reply.payload.ideas.length).toBe(3);
    const idea = reply.payload.ideas[0];
    const save = () => api('POST', '/ideas', { sourceKey: `${reply.run_id}:i0`, kind: 'seed', title: idea.title, concept: idea.concept, lines: idea.lines, sourceRunId: reply.run_id });
    const a = await save(), b = await save();
    expect(a.body.id).toBe(b.body.id);
    const j = (await api('GET', '/journal?filter=all')).body;
    expect(j.ideas.length).toBe(1);
    expect(j.ideas[0].lines.map((l: any) => l.text)).toEqual(idea.lines);
  });
});

describe('no writer connected', () => {
  beforeEach(() => boot(null));
  it('says so, keeps what he typed, and everything else still works', async () => {
    const r = await api('POST', '/messages', { threadId: null, text: 'ideas please', clientKey: 'x' });
    expect(r.status).toBe(503);
    const threads = (await api('GET', '/threads')).body;
    expect(threads.length).toBe(1);
    const t = (await api('GET', `/threads/${threads[0].id}`)).body;
    expect(t.messages[0].text).toBe('ideas please');
    const song = await makeSong();
    expect(song.sections[0].lines.length).toBe(4);
    const md = await fetch(`${base}/api/export.md`, { headers: { cookie } });
    expect(await md.text()).toContain('I was practicing leaving');
  });
});

describe('song edits', () => {
  // A badly behaved writer: rewrites whole lines, skips targets, and edits a line it was not given.
  const script = (req: WriterRequest) => ({
    reply: '', constraints: { count: null, linesPerOption: null, mustStartWith: null, mustEndWith: 'losing you', forbidden: [] },
    options: [
      { targets: [{ target: 'T1', text: 'I was practicing losing' }, { target: 'T2', text: 'Like saying made me lose you' }] },
      { targets: [{ target: 'T1', text: 'only one' }] },
      { targets: [{ target: 'T1', text: 'a' }, { target: 'T2', text: 'b' }, { target: 'T9', text: 'sneaky' }] },
      { targets: [{ target: 'T1', text: 'I was practicing losing' }, { target: 'T2', text: 'And I was busy losing you' }] },
    ],
    _req: req.model,
  });
  beforeEach(() => boot(new StandInWriter(script)));

  it('E1 literal edit is direct, free and byte-exact', async () => {
    const song = await makeSong();
    const last = song.sections[0].lines[3];
    const r = await api('POST', `/songs/${song.id}/edit`, { baseRev: 1, instruction: 'Change only the final word from leaving to losing. Keep everything else exactly the same.',
      targets: [{ kind: 'span', lineId: last.id, start: 17, end: 24, expected: 'leaving' }], clientKey: null });
    expect(r.body.direct).toBe(true);
    const acc = await api('POST', `/songs/${song.id}/accept`, { baseRev: 1, replacements: r.body.options[0].replacements, source: 'direct' });
    expect(acc.body.rev).toBe(2);
    const after = (await api('GET', `/songs/${song.id}`)).body;
    expect(after.sections[0].lines.map((l: any) => l.text).join('\n')).toBe(LYRIC.split('\n').slice(1).join('\n').replace('leaving', 'losing'));
    const runs = (await api('GET', '/receipts')).body;
    expect(runs.length).toBe(0); // no writer call
  });

  it('writer options that do not match the selection are discarded; checks are real', async () => {
    const song = await makeSong();
    const [l1, , , l4] = song.sections[0].lines;
    const r = await api('POST', `/songs/${song.id}/edit`, { baseRev: 1, instruction: "First line must become 'I was practicing losing'. Give options for the last line, each ending 'losing you'.",
      targets: [{ kind: 'line', lineId: l1.id, expected: l1.text }, { kind: 'line', lineId: l4.id, expected: l4.text }], clientKey: 'e1' });
    expect(r.body.direct).toBe(false);
    await svc.idle();
    const run = (await api('GET', `/runs/${r.body.runId}`)).body;
    const opts = run.result.options;
    expect(opts[1].invalid).toBeTruthy();
    expect(opts[2].invalid).toBeTruthy();
    expect(opts[0].checks.find((c: any) => c.label.startsWith('ends')).ok).toBe(false);
    expect(opts[3].checks.every((c: any) => c.ok)).toBe(true);
    // Only the two targeted lines appear in the diff
    expect(opts[3].diff.map((d: any) => d.lineId)).toEqual([l1.id, l4.id]);
  });

  it('a suggestion cannot overwrite a line he changed since; untouched lines rebase safely', async () => {
    const song = await makeSong();
    const [l1, l2, , l4] = song.sections[0].lines;
    // he edits line 2 by hand (rev 2)
    const text = LYRIC.replace('Like that was the same as staying', 'Like that counted as staying');
    expect((await api('PUT', `/songs/${song.id}/text`, { baseRev: 1, text })).body.rev).toBe(2);
    // a suggestion made against rev 1 for line 4 still applies
    const ok = await api('POST', `/songs/${song.id}/accept`, { baseRev: 1, replacements: [{ lineId: l4.id, newText: 'I was practicing losing' }], source: 'writer' });
    expect(ok.status).toBe(200);
    // a suggestion made against rev 1 for line 2 is refused
    const bad = await api('POST', `/songs/${song.id}/accept`, { baseRev: 1, replacements: [{ lineId: l2.id, newText: 'stale' }], source: 'writer' });
    expect(bad.status).toBe(409);
    const after = (await api('GET', `/songs/${song.id}`)).body;
    expect(after.sections[0].lines[1].text).toBe('Like that counted as staying');
    // stale free-text save is refused too
    expect((await api('PUT', `/songs/${song.id}/text`, { baseRev: 1, text: 'overwrite' })).status).toBe(409);
    void l1;
  });

  it('locked lines cannot change by any route', async () => {
    const song = await makeSong();
    const [l1] = song.sections[0].lines;
    await api('PATCH', `/songs/${song.id}`, { locks: [l1.id] });
    expect((await api('POST', `/songs/${song.id}/edit`, { baseRev: 1, instruction: 'make it better', targets: [{ kind: 'line', lineId: l1.id, expected: l1.text }], clientKey: null })).status).toBe(409);
    expect((await api('POST', `/songs/${song.id}/accept`, { baseRev: 1, replacements: [{ lineId: l1.id, newText: 'x' }], source: 'writer' })).status).toBe(400);
    expect((await api('PUT', `/songs/${song.id}/text`, { baseRev: 1, text: LYRIC.replace('I kept coming home', 'changed') })).status).toBe(400);
  });

  it('history: restore makes a new version, nothing is lost', async () => {
    const song = await makeSong();
    await api('PUT', `/songs/${song.id}/text`, { baseRev: 1, text: 'new words' });
    const r = await api('POST', `/songs/${song.id}/restore`, { rev: 1, baseRev: 2 });
    expect(r.body.rev).toBe(3);
    const revs = (await api('GET', `/songs/${song.id}/revisions`)).body;
    expect(revs.map((x: any) => x.rev)).toEqual([3, 2, 1]);
  });
});

describe('Suno prompt', () => {
  const script = () => ({
    style: 'modern country pop, 76 bpm, fingerpicked acoustic, warm male vocal', exclude: 'trap hi-hats',
    intro: ['[Intro: fingerpicked acoustic]', 'sneaky lyric line'],
    sections: [{ index: 0, tags: ['[Chorus: full band, open vocal]', '(not a tag)'] }],
    outro: ['[Fade Out]'],
  });
  beforeEach(() => boot(new StandInWriter(script)));
  it('uses his exact lyrics and only bracketed tags', async () => {
    const song = await makeSong();
    const r = await api('POST', `/songs/${song.id}/suno`, { hint: '', clientKey: null });
    await svc.idle();
    const after = (await api('GET', `/songs/${song.id}`)).body;
    expect(r.status).toBe(200);
    expect(after.suno.lyrics).toBe('[Intro: fingerpicked acoustic]\n\n[Chorus: full band, open vocal]\n' + LYRIC.split('\n').slice(1).join('\n') + '\n\n[Fade Out]\n[End]');
  });
});

describe('spending', () => {
  class LiveFake implements Writer {
    live = true; label = 'live fake';
    async write() { return { json: { kind: 'reply', reply: 'hi', ideas: [], options: [], draft: null, constraints: { count: null, linesPerOption: null, mustStartWith: null, mustEndWith: null, forbidden: [] } }, usage: { inputTokens: 1000, outputTokens: 2000, cacheReadTokens: 0, cacheWriteTokens: 0 }, model: 'claude-opus-5-5', requestId: 'req_1', stopReason: 'end_turn', live: true }; }
  }
  beforeEach(() => boot(new LiveFake()));
  it('blocks a request that could exceed the daily cap and records real cost otherwise', async () => {
    await api('PATCH', '/settings', { dailyCapUsd: 0.01 });
    const blocked = await api('POST', '/messages', { threadId: null, text: 'hello', clientKey: 'a' });
    expect(blocked.status).toBe(402);
    await api('PATCH', '/settings', { dailyCapUsd: 10 });
    const ok = await api('POST', '/messages', { threadId: null, text: 'hello', clientKey: 'b' });
    expect(ok.status).toBe(200);
    await svc.idle();
    const [run] = (await api('GET', '/receipts')).body;
    expect(Number(run.cost_usd)).toBeCloseTo((1000 * 4 + 2000 * 20) / 1e6, 6);
  });
});
