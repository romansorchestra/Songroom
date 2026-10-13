// Titles for the next section (13 Oct 2026). Sam, mid-song with a verse written and no way in
// but the direction box: "looking for the title for the next section. Here are the lyrics so far".
import { describe, it, expect, afterEach } from 'vitest';
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

const VERSE = "It's a chance I'm willing to take\nA mistake I'm willing to make\nCouldn't tell you where it'll go\nBut baby just know I'm good either way";
const isTitles = (req: WriterRequest) => 'titles' in (req.schema as any).properties;

describe('titles for the next section', () => {
  it('a song he brings in gets eight titles with the lines they land in; one tap makes it the title and puts its lines on the page', async () => {
    const calls: WriterRequest[] = [];
    let n = 0;
    await boot(new StandInWriter((req: WriterRequest) => {
      calls.push(req);
      if (!isTitles(req)) return { note: '', ideas: [] };
      n++;
      return { note: n === 1 ? '' : 'second round', titles: Array.from({ length: 8 }, (_, i) => ({ title: `Either Way ${n}.${i + 1}`, lines: [`I'm not asking what this is, either way ${n}.${i + 1}`, 'keep your hand right where it is'], why: 'pays off the last line' })) };
    }));
    await api('POST', '/lessons', { text: 'Never rhyme on "forever".' });
    const { body: song } = await api('POST', '/songs', { title: '', text: VERSE });
    const r = await api('POST', `/songs/${song.id}/titles`, { ask: 'the chorus title', clientKey: 't1' });
    expect(r.status).toBe(200);
    expect((await api('POST', `/songs/${song.id}/titles`, { ask: 'the chorus title', clientKey: 't1' })).body.runId).toBe(r.body.runId); // one tap, one run
    await svc.idle();
    const u = calls.find(isTitles)!.user;
    expect(u).toContain('Sam is mid-song and needs the title');
    expect(u).toContain("But baby just know I'm good either way");
    expect(u).toContain('What he says he wants:\nthe chorus title');
    expect(u).toContain('Give eight titles');
    expect(u).toContain('The scale a concept lives at.');
    expect(calls.find(isTitles)!.system).toContain('Never rhyme on "forever"');
    let ws = (await api('GET', `/songs/${song.id}`)).body;
    expect(ws.titles).toHaveLength(1);
    expect(ws.titles[0].status).toBe('done');
    expect(ws.titles[0].items).toHaveLength(8);
    expect(ws.titles[0].items[0]).toEqual({ title: 'Either Way 1.1', lines: ["I'm not asking what this is, either way 1.1", 'keep your hand right where it is'], why: 'pays off the last line' });
    expect(ws.title).toBe('');
    // use one
    const used = await api('POST', `/songs/${song.id}/titles/use`, { setId: ws.titles[0].id, index: 2 });
    expect(used.status).toBe(200);
    expect(used.body.title).toBe('Either Way 1.3');
    const fromWriter = used.body.scraps.filter((f: any) => f.source === 'writer');
    expect(fromWriter.map((f: any) => f.text)).toEqual(["I'm not asking what this is, either way 1.3", 'keep your hand right where it is']);
    expect(fromWriter[0].ask).toBe('Title: Either Way 1.3');
    expect(used.body.sections.map((s: any) => s.lines.length)).toEqual([4]); // the draft is untouched
    await api('POST', `/songs/${song.id}/titles/use`, { setId: ws.titles[0].id, index: 2 }); // twice is once
    expect((await api('GET', `/songs/${song.id}`)).body.scraps.filter((f: any) => f.source === 'writer')).toHaveLength(2);
    expect((await api('POST', `/songs/${song.id}/titles/use`, { setId: ws.titles[0].id, index: 9 })).status).toBe(404);
    // eight more avoid the first eight, and the newest set comes first
    await api('POST', `/songs/${song.id}/titles`, { ask: '', clientKey: 't2' }); await svc.idle();
    const u2 = calls.filter(isTitles)[1].user;
    expect(u2).toContain('Titles you have already offered for this song');
    expect(u2).toContain('- Either Way 1.1');
    expect(u2).toContain('What he says he wants:\nThe title for the next section.');
    ws = (await api('GET', `/songs/${song.id}`)).body;
    expect(ws.titles).toHaveLength(2);
    expect(ws.titles[0].items[0].title).toBe('Either Way 2.1');
    expect(ws.titles[0].error).toEqual({ code: 'note', message: 'second round' });
  });

  it('a failed call leaves a failed set, not a stuck one', async () => {
    await boot(new StandInWriter((req: WriterRequest) => { if (isTitles(req)) throw new Error('boom'); return { note: '', ideas: [] }; }));
    const { body: song } = await api('POST', '/songs', { text: VERSE });
    await api('POST', `/songs/${song.id}/titles`, { ask: '', clientKey: 'f1' }); await svc.idle();
    const ws = (await api('GET', `/songs/${song.id}`)).body;
    expect(ws.titles[0].status).toBe('failed');
    expect(ws.titles[0].error.message).toBeTruthy();
  });
});
