// 19 Oct 2026 commission, Phase D: his taste with fewer assumptions. Not keeping a finding is not
// rejecting it; the contrast review never switches a card off; his accepted edits are on record
// with who wrote them; and his song history reaches the writer only when switched on.

import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { openDb, migrate, type Db } from '../server/db.js';
import { Service } from '../server/service.js';
import { createApp } from '../server/app.js';
import { StandInWriter } from '../server/engine/standin.js';
import { loadPack } from '../server/engine/pack.js';
import { changedRuns, editsBlock } from '../server/edits.js';
import { CONTRASTS } from '../server/taste.js';
import { CARD, type FlawCard } from '../server/engine/tasteBank.js';
import { wordsOf, tapHits } from '../shared/taste.js';
import type { WriterRequest } from '../server/engine/writer.js';

let db: Db, svc: Service, server: Server, base: string, cookie = '';
const auth = { password: 'pw', secret: 'test-secret', secure: false };
class Recording extends StandInWriter { calls: WriterRequest[] = []; async write(req: WriterRequest) { this.calls.push(req); return super.write(req); } }
async function boot(w = new Recording()) {
  db = await openDb(undefined); await migrate(db);
  svc = new Service(db, w, loadPack(path.resolve(process.cwd(), 'research', 'pack')));
  server = createApp(svc, auth, { writerLabel: 'test', writerLive: false }).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'pw' }) });
  cookie = r.headers.get('set-cookie')!.split(';')[0];
  return w;
}
async function api(method: string, p: string, body?: unknown) {
  const r = await fetch(`${base}/api${p}`, { method, headers: { 'content-type': 'application/json', 'x-songroom': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
}
afterEach(async () => { await svc?.idle(); server?.close(); await db?.close(); });

const answerAll = (cards: any[]) => cards.map((c) => c.kind === 'pair'
  ? { card: c.id, kind: 'pair', repeat: c.repeat, pick: 'a', ms: 1500 }
  : { card: c.id, kind: 'flaw', tap: c.planted ? (() => { const f = CARD.get(c.id) as FlawCard; return { line: f.planted!.line, word: wordsOf(f.lines[f.planted!.line]).findIndex((_, i) => tapHits(f.lines[f.planted!.line], i, f.planted!.text)) }; })() : null, ms: 2500 });

describe('taste findings: kept, turned down, or still waiting', () => {
  it('records Not me as a rejection, leaves the rest waiting, and a later decision replaces an earlier one', async () => {
    await boot();
    const { cards } = (await api('GET', '/taste')).body;
    const r = await api('POST', '/taste/read', { session: 'sess-1', answers: answerAll(cards), songs: [] }); await svc.idle();
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const run = (await api('GET', `/runs/${r.body.runId}`)).body;
    const n = run.result.heard.length;
    expect(n).toBeGreaterThanOrEqual(1);
    expect((await api('GET', '/taste/pending')).body).toHaveLength(n); // nothing decided: all waiting, none rejected
    const k = await api('POST', '/taste/keep', { runId: r.body.runId, keep: [], reject: [0] });
    expect(k.body.decisions['0'].d).toBe('rejected');
    expect(k.body.decisions['0'].at).toBeTruthy();
    expect((await api('GET', '/taste/pending')).body).toHaveLength(n - 1);
    expect((await api('GET', '/lessons')).body).toHaveLength(0); // a rejection files nothing
    // he changes his mind
    const k2 = await api('POST', '/taste/keep', { runId: r.body.runId, keep: [0] });
    expect(k2.body.decisions['0'].d).toBe('kept');
    expect((await api('GET', '/lessons')).body).toHaveLength(1);
  });
});

describe('five quick pairs', () => {
  it('shows repaired pairs without the analyst\'s framing, in a fixed order, and records both / neither / wrong-for-this-song', async () => {
    await boot();
    const r = (await api('GET', '/taste/contrasts')).body;
    expect(r.pairs.map((p: any) => p.id)).toEqual(CONTRASTS);
    const e06 = r.pairs.find((p: any) => p.id === 'E06');
    expect(e06.version).toBe(2);
    for (const p of r.pairs) {
      expect(p.brief).not.toMatch(/versus/i); // the first sentence ("X versus Y") is the analyst's framing
      expect(p.sides.map((s: any) => s.key).sort()).toEqual(['a', 'b']);
    }
    const again = (await api('GET', '/taste/contrasts')).body;
    expect(again.pairs.map((p: any) => p.sides[0].key)).toEqual(r.pairs.map((p: any) => p.sides[0].key)); // never reshuffled
    await api('POST', '/taste/contrasts', { id: 'E13', pick: 'both', shown: r.pairs[0].sides.map((s: any) => s.key) });
    await api('POST', '/taste/contrasts', { id: 'E12', pick: 'a', wrongForSong: 'b', reason: 'b is better for a different song', shown: r.pairs[1].sides.map((s: any) => s.key) });
    const answers = (await api('GET', '/taste/contrasts')).body.answers;
    expect(answers.map((a: any) => [a.card, a.payload.pick, a.payload.wrongForSong])).toEqual([['E13', 'both', null], ['E12', 'a', 'b']]);
    // a contrast answer never touches the writer's instructions
    expect((await api('GET', '/lessons')).body).toHaveLength(0);
    expect((await api('POST', '/taste/contrasts', { id: 'E99', pick: 'a', shown: ['a', 'b'] })).status).toBe(404);
  });
});

describe('his accepted edits', () => {
  it('finds changed runs of lines', () => {
    expect(changedRuns(['a', 'b', 'c', 'd'], ['a', 'B', 'c', 'd'])).toEqual([{ before: ['b'], after: ['B'] }]);
    expect(changedRuns(['a', 'b', 'c'], ['a', 'c'])).toEqual([{ before: ['b'], after: [] }]);
    expect(changedRuns(['a', 'c'], ['a', 'x', 'y', 'c'])).toEqual([{ before: [], after: ['x', 'y'] }]);
  });

  it('reads his typed changes back as edits by him, and shows them to the writer only when song history is on', { timeout: 30000 }, async () => {
    const w = await boot();
    const LYRIC = '[Pre-Chorus]\nI used to tell them give him time\nLike I had all the time to give\n\n[Chorus]\nThought I was making you better for me\nNot better for her';
    const { body: made } = await api('POST', '/songs', { title: 'Better For Her', text: LYRIC });
    await new Promise((r) => setTimeout(r, 2100)); // past the editor settling window
    const edited = LYRIC.replace('Like I had all the time to give', 'I just never said how long');
    expect((await api('PUT', `/songs/${made.id}/text`, { baseRev: 1, text: edited })).status).toBe(200);
    const edits = (await api('GET', `/songs/${made.id}/edits`)).body;
    expect(edits).toEqual([expect.objectContaining({ rev: 2, source: 'typed', section: 'Pre-Chorus', before: ['Like I had all the time to give'], after: ['I just never said how long'], by: 'sam' })]);
    expect(editsBlock(edits)).toContain('his calls for this song only');
    // off by default: the writer never sees it
    const song = (await api('GET', `/songs/${made.id}`)).body;
    const line = song.sections[1].lines[0];
    await api('POST', `/songs/${made.id}/suggest`, { baseRev: song.current_rev, instruction: 'sharper', targets: [{ kind: 'line', lineId: line.id, expected: line.text }], clientKey: 'a' }); await svc.idle();
    expect(w.calls.at(-1)!.user).not.toContain('Changes he made to this song');
    await api('PATCH', '/settings', { songHistory: 'on' });
    await api('POST', `/songs/${made.id}/suggest`, { baseRev: song.current_rev, instruction: 'sharper still', targets: [{ kind: 'line', lineId: line.id, expected: line.text }], clientKey: 'b' }); await svc.idle();
    expect(w.calls.at(-1)!.user).toContain('"Like I had all the time to give" → "I just never said how long"');
    expect((await api('PATCH', '/settings', { songHistory: 'sometimes' })).status).toBe(400);
  });
});
