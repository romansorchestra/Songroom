// The hang (11 Oct 2026): the talk before a session, read afterwards for titles, concepts
// and lines. Nothing invented reaches him; the transcript is gone once it has been read.
import { describe, it, expect, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { openDb, migrate, type Db } from '../server/db.js';
import { Service } from '../server/service.js';
import { createApp } from '../server/app.js';
import { StandInWriter } from '../server/engine/standin.js';
import type { Writer, WriterRequest } from '../server/engine/writer.js';
import type { Transcriber } from '../server/engine/transcribe.js';
import { verifyCandidates } from '../server/hang.js';
import { layout } from '../server/engine/transcribe.js';

let db: Db, svc: Service, server: Server, base: string, cookie = '';
const auth = { password: 'pw', secret: 'test-secret', secure: false };
async function boot(writer: Writer | null, transcriber: Transcriber | null = null) {
  db = await openDb(undefined); await migrate(db);
  svc = new Service(db, writer, null);
  server = createApp(svc, auth, { writerLabel: 'test', writerLive: !!writer?.live, transcriber }).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'pw' }) });
  cookie = r.headers.get('set-cookie')!.split(';')[0];
}
async function api(method: string, path: string, body?: unknown) {
  const r = await fetch(`${base}/api${path}`, { method, headers: { 'content-type': 'application/json', 'x-songroom': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
}
afterEach(async () => { await svc?.idle(); server?.close(); await db?.close(); });

const TRANSCRIPT = `[0:12] Speaker 1: so how've you been, honestly
[0:15] Speaker 2: I mean I'm being so normal about it. Like aggressively normal. We were at my friend's wedding and the seating chart was done before we broke up so I'm at his table.
[0:41] Speaker 1: oh no
[0:43] Speaker 2: and I asked how his mum is. I'm on my third wine at this point. He still cuts his whole steak up before he eats it and I still know that about him.
[1:20] Speaker 3: should we order food
[1:25] Speaker 2: yeah whatever's easy. anyway I just want to be boring now, like let's get a Costco card boring.`;

describe('the hang', () => {
  it('keeps only what was really said; an invented phrase is dropped and a loose context is replaced', () => {
    const kept = verifyCandidates([
      { kind: 'title', text: "I'm being so normal", saidBy: 'Speaker 2', at: '0:15', context: "I mean I'm being so normal about it. Like aggressively normal.", why: 'plain phrase, carries the whole stance', score: 3 },
      { kind: 'line', text: 'I asked how his mother was doing', saidBy: 'Speaker 2', at: '0:43', context: 'x', why: 'improved by the model', score: 3 },
      { kind: 'concept', text: "let's get a Costco card boring", saidBy: 'Speaker 2', at: '1:25', context: 'a paraphrase that is not in the transcript at all', why: 'wanting the dull life', score: 2 },
      { kind: 'title', text: 'Being So Normal', saidBy: '', at: '', context: '', why: 'dupe by sound', score: 1 },
    ], TRANSCRIPT);
    expect(kept.map((c) => c.text)).toEqual(["I'm being so normal", "let's get a Costco card boring"]);
    expect(kept[1].context).toContain('Costco card boring');
    expect(kept[1].context.toLowerCase()).not.toContain('paraphrase');
  });

  it('a pasted transcript is read once, the transcript is then gone, and a candidate becomes the idea on screen', async () => {
    const calls: WriterRequest[] = [];
    await boot(new StandInWriter((req: WriterRequest) => {
      calls.push(req);
      return { note: '', candidates: [
        { kind: 'title', text: "I'm being so normal", saidBy: 'Speaker 2', at: '0:15', context: "I mean I'm being so normal about it. Like aggressively normal.", why: 'the whole stance in four words', score: 3 },
        { kind: 'line', text: 'He still cuts his whole steak up before he eats it', saidBy: 'Speaker 2', at: '0:43', context: 'He still cuts his whole steak up before he eats it and I still know that about him.', why: 'a detail only an ex knows', score: 3 },
        { kind: 'title', text: 'made this up entirely', saidBy: '', at: '', context: '', why: '', score: 3 },
      ] };
    }));
    const r = await api('POST', '/hangs', { title: 'Tuesday with M', text: TRANSCRIPT });
    expect(r.status).toBe(200);
    await svc.idle();
    expect(calls.length).toBe(1);
    expect(calls[0].system).toContain('copied word for word');
    expect(calls[0].user).toContain('third wine');
    const h = (await api('GET', `/hangs/${r.body.id}`)).body;
    expect(h.status).toBe('done');
    expect(h.hasTranscript).toBe(false);
    expect(h.transcript).toBeUndefined();
    expect(h.candidates.map((c: any) => c.text)).toEqual(["I'm being so normal", 'He still cuts his whole steak up before he eats it']);
    expect((await db.query<{ transcript: string | null }>(`SELECT transcript FROM hangs`))[0].transcript).toBe(null);
    // the list never carries transcripts
    expect((await api('GET', '/hangs')).body[0].candidates).toBe(2);
    // a candidate becomes the idea on the Write screen; doing it twice reuses it
    const a = await api('POST', `/hangs/${r.body.id}/idea`, { index: 0 });
    const b = await api('POST', `/hangs/${r.body.id}/idea`, { index: 0 });
    expect(a.body.ideaId).toBe(b.body.ideaId);
    const sb = (await api('GET', '/springboard')).body;
    expect(sb.current.id).toBe(a.body.ideaId);
    expect(sb.current.title).toBe("I'm being so normal");
    expect(sb.current.lines[0].text).toBe("I mean I'm being so normal about it. Like aggressively normal.");
    expect(sb.current.note).toContain('Tuesday with M');
    // save sends it to the journal
    const s = await api('POST', `/hangs/${r.body.id}/save`, { index: 1 });
    expect((await api('GET', '/journal?filter=ideas')).body.entries.map((e: any) => e.id)).toContain(s.body.ideaId);
    // dismiss is remembered
    await api('POST', `/hangs/${r.body.id}/dismiss`, { index: 1 });
    expect((await api('GET', `/hangs/${r.body.id}`)).body.dismissed).toEqual([1]);
    expect((await api('POST', '/hangs', { title: '', text: 'too short' })).status).toBe(400);
  });

  it('a recording is transcribed in the background, billed by the minute, then read; the file is deleted', async () => {
    const fs = await import('node:fs');
    const seen: string[] = [];
    const fake: Transcriber = { label: 'fake', usdPerMinute: 0.01, async transcribe(p, ct) { seen.push(`${ct}:${fs.statSync(p).size}`); return { text: TRANSCRIPT, minutes: 61.5, speakers: 3, provider: 'fake' }; } };
    await boot(new StandInWriter(), fake);
    const r = await fetch(`${base}/api/hangs/audio?title=Thursday`, { method: 'POST', headers: { 'content-type': 'audio/x-m4a', 'x-songroom': '1', cookie }, body: Buffer.alloc(5000, 7) });
    expect(r.status).toBe(200);
    const { id } = await r.json() as { id: string };
    expect((await api('GET', `/hangs/${id}`)).body.status).toMatch(/transcribing|extracting|done/);
    await svc.idle();
    const h = (await api('GET', `/hangs/${id}`)).body;
    expect(h.status).toBe('done');
    expect(h.minutes).toBe(61.5); expect(h.speakers).toBe(3);
    expect(seen).toEqual(['audio/x-m4a:5000']);
    expect(h.candidates.length).toBeGreaterThan(0);
    const [t] = await db.query<{ cost_usd: number; model: string }>(`SELECT cost_usd, model FROM runs WHERE task='transcribe'`);
    expect(t.cost_usd).toBeCloseTo(0.615, 3);
    expect(fs.readdirSync((await import('node:os')).tmpdir()).filter((f) => f.startsWith('hang-')).length).toBe(0);
  });

  it('without a transcription key, a recording is refused with the reason and pasting still works', async () => {
    await boot(new StandInWriter(), null);
    expect((await api('GET', '/status')).body.transcriber).toEqual({ configured: false, label: null, usdPerMinute: null });
    const r = await fetch(`${base}/api/hangs/audio`, { method: 'POST', headers: { 'content-type': 'audio/mpeg', 'x-songroom': '1', cookie }, body: Buffer.alloc(100) });
    expect(r.status).toBe(503);
    expect(((await r.json()) as any).error.message).toContain('DEEPGRAM_API_KEY');
    const bad = await fetch(`${base}/api/hangs/audio`, { method: 'POST', headers: { 'content-type': 'text/plain', 'x-songroom': '1', cookie }, body: 'hello' });
    expect(bad.status).toBe(415);
    expect((await api('POST', '/hangs', { text: TRANSCRIPT })).status).toBe(200);
  });

  it('lays words out as timed, speaker-labelled paragraphs', () => {
    const w = (word: string, start: number, speaker: number) => ({ word, punctuated_word: word, start, end: start + 0.3, speaker });
    const { text, speakers } = layout([w('so', 12, 0), w('how', 12.4, 0), w('are', 12.8, 0), w('you', 13.1, 0), w("I'm", 15, 1), w('fine.', 15.3, 1), w('Really.', 19.5, 1)]);
    expect(text).toBe("[0:12] Speaker 1: so how are you\n[0:15] Speaker 2: I'm fine.\n[0:19] Speaker 2: Really.");
    expect(speakers).toBe(2);
  });
});
