// Browse (11 Oct 2026, late). Sam: "How am I supposed to just generate and browse a bunch of
// ideas that are just good relationship titles (with a concept and a few lines)… the few
// lines should be based around the title, like how you would use it in the chorus. Some
// should start with the title, some should end with it. Some could maybe just have it in
// passing." A list is ten ideas at once; every idea's lines carry its title where assigned.
import { describe, it, expect, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { openDb, migrate, type Db } from '../server/db.js';
import { Service } from '../server/service.js';
import { createApp } from '../server/app.js';
import { StandInWriter } from '../server/engine/standin.js';
import type { Writer, WriterRequest } from '../server/engine/writer.js';
import { hookPlacement, assignHooks } from '../server/engine/hook.js';
import { pickSubjects, RELATIONSHIP_SUBJECTS } from '../server/engine/barometer.js';

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

const idea = (n: number, title = `Title ${n}`) => ({ title, titleParts: [title], concept: `c${n}`, lines: [`${title}, end of day`, 'we play', 'tonight', 'the light'], rhymes: 'day / play, tonight / light' });
const batchOf = (req: WriterRequest) => Number((req.user.match(/Give (\d+) distinct/) ?? [])[1] ?? 3);

describe('where the title lands', () => {
  it('reads the title out of the lines, however it is punctuated or cased', () => {
    expect(hookPlacement("Somebody's Gonna Tell You", ["Somebody's gonna tell you, I was out last night", 'a', 'b', 'c'])).toBe('open');
    expect(hookPlacement("Somebody's Gonna Tell You", ['a', 'b', 'c', "and somebody's gonna tell you."])).toBe('close');
    expect(hookPlacement("Somebody's Gonna Tell You", ['a', "well, somebody's gonna tell you anyway", 'c', 'd'])).toBe('passing');
    expect(hookPlacement("Somebody's Gonna Tell You", ['a', 'somebody is gonna tell you', 'c', 'd'])).toBe('none');
    expect(hookPlacement('Same Time Next Week', ['Same Time Next Week'])).toBe('open');
    expect(hookPlacement('', ['a'])).toBe('none');
    expect(assignHooks(4, 1)).toEqual(['close', 'passing', 'open', 'close']);
  });

  it('relationship-only subjects, and a list of ten reuses subjects across rounds without repeating within one', () => {
    const ten = pickSubjects('pop', 10, [], Math.random, 'relationship');
    expect(ten).toHaveLength(10);
    expect(ten.every((k) => RELATIONSHIP_SUBJECTS.includes(k))).toBe(true);
    expect(new Set(ten.slice(0, 5)).size).toBe(5);
    const mixed = pickSubjects('pop', 3);
    expect(new Set(mixed).size).toBe(3);
  });
});

describe('browse: ten titles at once', () => {
  it('writes ten relationship ideas with placements, lists them newest first, never feeds them to the one-at-a-time queue, and opens one on Write', async () => {
    const calls: WriterRequest[] = [];
    await boot(new StandInWriter((req: WriterRequest) => { calls.push(req); return { note: '', ideas: Array.from({ length: batchOf(req) }, (_, i) => idea(i + calls.length * 100)) }; }));
    expect((await api('GET', '/browse')).body.batches).toEqual([]);
    await api('PUT', '/springboard/direction', { genre: 'pop' });
    const r = await api('POST', '/browse/list', { clientKey: 'l1' });
    expect(r.status).toBe(200);
    expect((await api('POST', '/browse/list', { clientKey: 'l1' })).body.runId).toBe(r.body.runId); // one tap, one run
    await svc.idle();
    const u = calls[0].user;
    expect(u).toContain('Give 10 distinct song ideas');
    expect(u).toContain('relationships only, as he asked');
    expect(u).toMatch(/1\. .*\n   Title: the (title opens the block|block lands on the title|title is said in passing)/);
    expect(u).toContain('the part of the chorus where the title lands');
    expect((u.match(/Title: the title opens the block/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((u.match(/Title: the block lands on the title/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((u.match(/Title: the title is said in passing/g) ?? []).length).toBeGreaterThanOrEqual(3);
    const run = (await api('GET', `/runs/${r.body.runId}`)).body;
    expect(run.task).toBe('list');
    expect(run.result.rhyme.hook.want).toHaveLength(10);
    expect(run.result.rhyme.retried).toEqual([]); // every block opened with its title and rhymed
    const [{ request }] = await db.query<{ request: any }>(`SELECT request FROM runs WHERE id=$1`, [r.body.runId]);
    expect(request.scope).toBe('relationship');
    expect(request.subjects.every((k: string) => RELATIONSHIP_SUBJECTS.includes(k))).toBe(true);
    const b = (await api('GET', '/browse')).body;
    expect(b.batches).toHaveLength(1);
    expect(b.batches[0].ideas).toHaveLength(10);
    expect(b.batches[0].ideas[0]).toMatchObject({ title: 'Title 100', concept: 'c100', saved: false });
    expect(b.batches[0].ideas[0].lines[0].text).toBe('Title 100, end of day');
    // the Write screen is untouched, and New idea there does not pull a listed one
    expect((await api('GET', '/springboard')).body.current).toBe(null);
    await api('POST', '/springboard/next', { clientKey: 'n1' }); await svc.idle();
    const sb = (await api('GET', '/springboard')).body;
    expect(sb.current.title).not.toMatch(/^Title 1\d\d$/);
    expect(calls).toHaveLength(2); // the list, then a batch of three
    // a second list goes above the first
    await api('POST', '/browse/list', { clientKey: 'l2', scope: 'all' }); await svc.idle();
    const b2 = (await api('GET', '/browse')).body;
    expect(b2.batches).toHaveLength(2);
    expect(b2.batches[0].ideas[0].title).toBe('Title 300');
    expect(b2.batches[1].ideas[0].title).toBe('Title 100');
    expect(calls[2].user).not.toContain('relationships only');
    // opening one makes it the idea on the Write screen; it leaves the list
    const pick = b2.batches[1].ideas[3];
    const opened = await api('POST', '/springboard/current', { ideaId: pick.id });
    expect(opened.body.current.id).toBe(pick.id);
    expect((await api('GET', '/browse')).body.batches[1].ideas.map((i: any) => i.id)).not.toContain(pick.id);
    // a list written to another genre is not shown for this one, and comes back when he returns
    await api('PUT', '/springboard/direction', { genre: 'country' });
    expect((await api('GET', '/browse')).body.batches).toEqual([]);
    await api('PUT', '/springboard/direction', { genre: 'pop' });
    expect((await api('GET', '/browse')).body.batches).toHaveLength(2);
  });

  it('a block without its title goes back with the rhyme retry, and the version with the title is kept', async () => {
    const calls: string[] = [];
    await boot(new StandInWriter((req: WriterRequest) => {
      calls.push(req.user);
      const props = (req.schema as any).properties;
      if ('index' in (props.ideas?.items?.properties ?? {})) return { note: '', ideas: [{ index: 2, lines: ['I said I would, and I did', 'Title 1, I kept the lid', 'You say my name like a dare', 'And I show up, and I stay there'], rhymes: 'did / lid, dare / there' }] };
      return { note: '', ideas: [idea(0), { ...idea(1), lines: ['no title here, end of day', 'we play', 'tonight', 'the light'] }, idea(2)] };
    }));
    await api('POST', '/springboard/next', { clientKey: 'n1' }); await svc.idle();
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain('the title "Title 1" is not in the lines word for word');
    expect(calls[1]).not.toContain('"Title 0"');
    expect(calls[1]).toMatch(/Title: the (title opens the block|block lands on the title|title is said in passing)/);
    const rows = await db.query<{ title: string; lines: Array<{ text: string }> }>(`SELECT title, lines FROM ideas WHERE origin='spark' ORDER BY rowid`);
    expect(rows.find((r) => r.title === 'Title 1')!.lines.map((l) => l.text)).toEqual(['I said I would, and I did', 'Title 1, I kept the lid', 'You say my name like a dare', 'And I show up, and I stay there']);
    const [run] = await db.query<{ result: any }>(`SELECT result FROM runs WHERE task='spark' ORDER BY created_at DESC LIMIT 1`);
    expect(run.result.rhyme.retried).toEqual([1]);
    expect(run.result.rhyme.hook.before[1]).toBe('none');
    expect(run.result.rhyme.hook.after[1]).toBe('passing');
  });
});
