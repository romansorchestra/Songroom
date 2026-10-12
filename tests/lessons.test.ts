// What Sam has told the writer (11 Oct 2026, late). He asked, after "call" was rhymed with
// "hall" ("sounds like a wedding or church"): "Will it learn from me if I told it that?"
// A note he sends with a rework is boiled down to one standing instruction, kept, read by
// the writer on every request from then on, and removable in Settings.
import { describe, it, expect, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { openDb, migrate, type Db } from '../server/db.js';
import { Service } from '../server/service.js';
import { createApp } from '../server/app.js';
import { StandInWriter } from '../server/engine/standin.js';
import type { Writer, WriterRequest } from '../server/engine/writer.js';
import { sameLesson, lessonsBlock } from '../server/engine/lessons.js';
import { systemCore, PROMPT_VERSION } from '../server/engine/prompts.js';

let db: Db, svc: Service, server: Server, base: string, cookie = '';
const auth = { password: 'pw', secret: 'test-secret', secure: false };
async function boot(writer: Writer | null) {
  db = await openDb(undefined); await migrate(db);
  svc = new Service(db, writer, null);
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

const HALL = 'A rhyme word must belong in the scene: "hall" after a night out reads as a wedding or a church.';
const sparkJson = () => ({ note: '', ideas: [0, 1, 2].map((i) => ({ title: `Title ${i}`, titleParts: [`Title ${i}`], concept: `c${i}`, lines: [`line ${i}a, end of day`, `line ${i}b, we play`, `line ${i}c, tonight`, `line ${i}d, the light`] })) });
const isRework = (req: WriterRequest) => { const p = (req.schema as any).properties; return 'titleParts' in p && 'lesson' in p; };

async function firstIdea() {
  await api('POST', '/springboard/next', { clientKey: 'n1' }); await svc.idle();
  return (await api('GET', '/springboard')).body;
}

describe('the writer learns from his notes', () => {
  it('a rework note with a rule in it becomes a lesson, shown on the reworked idea and read on every request after', async () => {
    const calls: WriterRequest[] = [];
    let lesson = HALL;
    await boot(new StandInWriter((req: WriterRequest) => {
      calls.push(req);
      if (isRework(req)) return { title: 'T', titleParts: ['T'], concept: 'c', lines: ['a', 'b', 'c', 'd'], lesson, note: '' };
      return sparkJson();
    }));
    const sb = await firstIdea();
    expect(calls[0].system).not.toContain('What Sam has told the writer'); // nothing yet
    expect(calls[0].system).toContain('would this narrator say it, here'); // p2.2
    const r = await api('POST', `/ideas/${sb.current.id}/rework`, { feedback: "'hall' is wrong here, sounds like a wedding or a church", changeLineIds: [sb.current.lines[3].id], clientKey: 'rw1' });
    expect(r.status).toBe(200);
    await svc.idle();
    expect(calls.at(-1)!.user).toContain('"lesson"');
    expect(calls.at(-1)!.user).not.toContain('He has already told you'); // the list was empty
    const now = (await api('GET', '/springboard')).body;
    expect(now.current.parent_id).toBe(sb.current.id);
    expect(now.current.lesson).toEqual({ id: expect.any(String), text: HALL });
    const list = (await api('GET', '/lessons')).body;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ text: HALL, source: 'rework', idea_id: now.current.id, note: "'hall' is wrong here, sounds like a wedding or a church" });
    // every request from now on carries it: a new batch, and the next rework names it as already said
    await api('PUT', '/springboard/direction', { genre: 'country' });
    await api('POST', '/springboard/next', { clientKey: 'n2' }); await svc.idle();
    expect(calls.at(-1)!.system).toContain(`What Sam has told the writer`);
    expect(calls.at(-1)!.system).toContain(`- ${HALL}`);
    expect(calls.at(-1)!.system.indexOf(systemCore(PROMPT_VERSION))).toBe(0);
    const [run] = await db.query<{ request: any }>(`SELECT request FROM runs WHERE task='spark' ORDER BY created_at DESC LIMIT 1`);
    expect(run.request.lessons).toBe(1);
    lesson = '';
    await api('POST', `/ideas/${now.current.id}/rework`, { feedback: 'make it sexier', keepTitle: true, clientKey: 'rw2' }); await svc.idle();
    expect(calls.at(-1)!.user).toContain(`He has already told you:\n  - ${HALL}`);
    expect((await api('GET', '/lessons')).body).toHaveLength(1); // an empty lesson adds nothing
    const latest = (await api('GET', '/springboard')).body.current;
    expect(latest.lesson).toBe(null);
  });

  it('the same lesson twice is one; a rework with no note learns nothing; a preview rework saves nothing at all', async () => {
    await boot(new StandInWriter((req: WriterRequest) => (isRework(req) ? { title: 'T', titleParts: ['T'], concept: 'c', lines: ['a'], lesson: HALL, note: '' } : sparkJson())));
    const sb = await firstIdea();
    await api('POST', `/ideas/${sb.current.id}/rework`, { feedback: 'hall is wrong', clientKey: 'a' }); await svc.idle();
    const second = (await api('GET', '/springboard')).body.current;
    await api('POST', `/ideas/${second.id}/rework`, { feedback: 'hall is still wrong', clientKey: 'b' }); await svc.idle();
    expect((await api('GET', '/lessons')).body).toHaveLength(1);
    const third = (await api('GET', '/springboard')).body.current;
    await api('POST', `/ideas/${third.id}/rework`, { keepTitle: true, clientKey: 'c' }); await svc.idle(); // marks only, no note
    expect((await api('GET', '/lessons')).body).toHaveLength(1);
    const fourth = (await api('GET', '/springboard')).body.current;
    expect(fourth.id).not.toBe(third.id);
    const before = (await db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ideas`))[0].n;
    const p = await api('POST', `/ideas/${fourth.id}/rework`, { feedback: 'aisle is wrong too', applyToNew: true, preview: true, clientKey: 'p' });
    expect(p.status).toBe(200);
    await svc.idle();
    const [run] = await db.query<{ task: string; status: string; result: any; request: any }>(`SELECT task, status, result, request FROM runs WHERE id=$1`, [p.body.runId]);
    expect(run.task).toBe('preview');
    expect(run.status).toBe('succeeded');
    expect(run.result.lesson).toBe(HALL);
    expect(run.request.preview).toBe(true);
    expect((await db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ideas`))[0].n).toBe(before); // no idea saved
    expect((await api('GET', '/lessons')).body).toHaveLength(1); // no lesson saved
    expect((await api('GET', '/springboard')).body.direction.text).toBe(''); // no direction change
    expect((await api('GET', '/springboard')).body.current.id).toBe(fourth.id); // the screen is untouched
  });

  it('he can add one in his own words in Settings and cross any out; a crossed-out lesson leaves the brief', async () => {
    const systems: string[] = [];
    await boot(new StandInWriter((req: WriterRequest) => { systems.push(req.system); return sparkJson(); }));
    const added = await api('POST', '/lessons', { text: '  Never rhyme on "forever".  ' });
    expect(added.status).toBe(200);
    expect(added.body).toMatchObject({ text: 'Never rhyme on "forever".', source: 'settings', idea_id: null });
    expect((await api('POST', '/lessons', { text: 'never rhyme on forever' })).status).toBe(409); // the same one
    expect((await api('POST', '/lessons', { text: 'no' })).status).toBe(400);
    await api('POST', '/springboard/next', { clientKey: 'n1' }); await svc.idle();
    expect(systems.at(-1)).toContain('- Never rhyme on "forever".');
    await api('POST', '/springboard/preview', { genre: 'pop', clientKey: 'pv' }); await svc.idle();
    expect(systems.at(-1)).toContain('- Never rhyme on "forever".');
    expect((await api('DELETE', `/lessons/${added.body.id}`)).status).toBe(200);
    expect((await api('GET', '/lessons')).body).toEqual([]);
    await api('PUT', '/springboard/direction', { genre: 'country' });
    await api('POST', '/springboard/next', { clientKey: 'n2' }); await svc.idle();
    expect(systems.at(-1)).not.toContain('What Sam has told the writer');
    // the backup carries the list
    await api('POST', '/lessons', { text: 'Keep titles under five words.' });
    const r = await fetch(`${base}/api/export.json`, { headers: { cookie } });
    expect(((await r.json()) as any).lessons).toHaveLength(1);
  });

  it('newest first in the brief, capped; near-duplicates are one', () => {
    expect(sameLesson('Never use "hall" as a rhyme word.', 'never use hall as a rhyme word')).toBe(true);
    expect(sameLesson('Never use "hall".', 'A rhyme word must belong in the scene: never use "hall".')).toBe(true);
    expect(sameLesson('Never use "hall".', 'Never use "aisle".')).toBe(false);
    expect(lessonsBlock([])).toBe('');
    expect(lessonsBlock(['b', 'a'])).toBe(`What Sam has told the writer, from his notes on earlier ideas. Standing instructions, newest first; they hold for every idea, line and edit unless today's request says otherwise:\n- b\n- a`);
  });
});
