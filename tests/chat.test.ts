// The chat (3 Nov 2026): a conversation with his memory behind it, streamed; lyrics saved to
// Songs (or as a song's next version); "remember …" files a standing note. Stand-in writer:
// these check the plumbing, never the writing.

import { describe, it, expect, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { openDb, migrate, type Db } from '../server/db.js';
import { Service } from '../server/service.js';
import { createApp } from '../server/app.js';
import { StandInWriter } from '../server/engine/standin.js';
import { lyricFrom, mergeInto } from '../server/chat.js';
import { WriterError, type ChatRequest, type ChatResult } from '../server/engine/writer.js';

let db: Db, svc: Service, server: Server, base: string, cookie = '';
const auth = { password: 'pw', secret: 'test-secret', secure: false };

class Recording extends StandInWriter {
  chats: ChatRequest[] = [];
  failNext = false;
  reply: string | null = null;
  async chat(req: ChatRequest, onText: (d: string) => void): Promise<ChatResult> {
    this.chats.push(req);
    if (this.failNext) { this.failNext = false; throw new WriterError('provider', 'Anthropic error 529: overloaded'); }
    if (this.reply) { onText(this.reply); return { text: this.reply, usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, model: 'stand-in', requestId: null, live: false, truncated: false }; }
    return super.chat(req, onText);
  }
}

async function boot(w = new Recording()) {
  db = await openDb(undefined); await migrate(db);
  svc = new Service(db, w, null);
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
const text = (song: any) => song.sections.map((x: any) => `[${x.label}]\n` + x.lines.map((l: any) => l.text).join('\n')).join('\n\n');
afterEach(async () => { await svc?.idle(); server?.close(); await db?.close(); });

describe('reading a lyric out of a reply', () => {
  it('takes the title line, title-cases capitals, picks the block asked for, and ignores one-liners', () => {
    const reply = 'Here it is.\n\n```\nALREADY LATE\n\n[Verse 1]\nline one\nline two\n```\n\nAnd the style:\n```\nmodern country ballad\n```';
    expect(lyricFrom(reply)).toEqual({ title: 'Already Late', lyric: '[Verse 1]\nline one\nline two' });
    expect(lyricFrom(reply, 1)).toBeNull();
    expect(lyricFrom('```\n[Chorus]\nhold on\nlet go\n```')).toEqual({ title: '', lyric: '[Chorus]\nhold on\nlet go' });
    expect(lyricFrom('no block here')).toBeNull();
  });
});

describe('a part of a song goes back into the whole song', () => {
  const whole = '[Verse 1]\na\nb\nc\nd\n\n[Chorus]\ne\nf\n\n[Verse 2]\ng\nh\ni\nj\n\n[Chorus]\ne\nf\n\n[Bridge]\nk\nl\n\n[Chorus]\ne\nf';
  it('replaces the sections it gives (a chorus every time it comes round) and keeps the rest', () => {
    expect(mergeInto(whole, '[Bridge]\nK\nL')).toBe(whole.replace('k\nl', 'K\nL'));
    expect(mergeInto(whole, '[chorus]\nE\nF')).toBe(whole.replaceAll('e\nf', 'E\nF'));
  });
  it('leaves alone a new version of most of the song, a section the song hasn’t got, and unlabelled lines', () => {
    expect(mergeInto(whole, '[Verse 1]\na\nb\nc\nd\n\n[Chorus]\ne\nf\n\n[Verse 2]\ng\nh\ni\nj\n\n[Chorus]\ne\nf')).toBeNull();
    expect(mergeInto(whole, '[Pre-Chorus]\nx\ny')).toBeNull();
    expect(mergeInto(whole, 'x\ny')).toBeNull();
  });
});

describe('the chat', () => {
  it('starts a chat, answers with his memory behind it, and lists it apart from the older sessions', { timeout: 20000 }, async () => {
    const w = await boot();
    await api('POST', '/lessons', { text: 'Never use "tonight" as a rhyme word.' });
    const r = await api('POST', '/chats', { text: 'Write me a country song called Already Late', clientKey: 'a1' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    await svc.idle();
    const t = (await api('GET', `/chats/${r.body.threadId}`)).body;
    expect(t.messages.map((m: any) => m.role)).toEqual(['user', 'assistant']);
    expect(t.messages[1].text).toContain('[stand-in]');
    expect(t.pending).toBeNull();
    expect(t.failed).toBeNull();
    expect(t.title).toBe('Write me a country song called Already Late');
    // his memory went with it; nothing else stacked on top
    expect(w.chats[0].system).toContain('Never use "tonight" as a rhyme word.');
    expect(w.chats[0].system).not.toContain('Craft notes');
    expect(w.chats[0].turns).toEqual([{ role: 'user', text: 'Write me a country song called Already Late' }]);
    const run = (await db.query<any>(`SELECT task, prompt_version FROM runs WHERE id=$1`, [r.body.runId]))[0];
    expect(run).toEqual({ task: 'chat', prompt_version: 'chat1' });
    // the follow-up carries the conversation
    await api('POST', '/chats', { threadId: r.body.threadId, text: 'Lines 3 and 4 should rhyme like the others', clientKey: 'a2' });
    await svc.idle();
    expect(w.chats[1].turns.map((x) => x.role)).toEqual(['user', 'assistant', 'user']);
    expect((await api('GET', '/chats')).body.map((c: any) => c.id)).toEqual([r.body.threadId]);
    expect((await api('GET', '/threads')).body).toEqual([]);
  });

  it('“remember …” files a standing note and hides the marker; the next chat reads it', { timeout: 20000 }, async () => {
    const w = await boot();
    const r = await api('POST', '/chats', { text: 'remember that I never want filler like "I know, I know"', clientKey: 'b1' });
    await svc.idle();
    const t = (await api('GET', `/chats/${r.body.threadId}`)).body;
    expect(t.messages[1].text).not.toContain('[[remember');
    expect(t.messages[1].payload.remembered).toHaveLength(1);
    const lessons = (await api('GET', '/lessons')).body;
    expect(lessons).toHaveLength(1);
    expect(lessons[0]).toMatchObject({ source: 'chat', scope: 'standing' });
    expect(lessons[0].text).toContain('I never want filler');
    await api('POST', '/chats', { text: 'a new song', clientKey: 'b2' }); await svc.idle();
    expect(w.chats[1].system).toContain('I never want filler');
  });

  it('saves a lyric to Songs, then the next save in that chat becomes the song’s next version', { timeout: 20000 }, async () => {
    const w = await boot();
    const r = await api('POST', '/chats', { text: 'write the song', clientKey: 'c1' }); await svc.idle();
    let t = (await api('GET', `/chats/${r.body.threadId}`)).body;
    const s1 = await api('POST', `/chats/${t.id}/save`, { messageId: t.messages[1].id, index: 0 });
    expect(s1.body.created).toBe(true);
    const song = (await api('GET', `/songs/${s1.body.songId}`)).body;
    expect(song.title).toBe('Stand-In Song');
    expect(song.sections.map((x: any) => x.label)).toEqual(['Verse 1', 'Chorus']);
    t = (await api('GET', `/chats/${t.id}`)).body;
    expect(t.song_id).toBe(s1.body.songId);
    expect(t.messages[1].payload).toMatchObject({ savedSongId: s1.body.songId, saved: [0] });
    w.reply = '[stand-in] Changed.\n\n```\nSTAND-IN SONG\n\n[Verse 1]\n[stand-in] first line of the verse\n[stand-in] second line of the verse\n\n[Chorus]\n[stand-in] a new chorus line\n[stand-in] the chorus line again\n```';
    await api('POST', '/chats', { threadId: t.id, text: 'change the chorus', clientKey: 'c2' }); await svc.idle();
    t = (await api('GET', `/chats/${t.id}`)).body;
    const s2 = await api('POST', `/chats/${t.id}/save`, { messageId: t.messages[3].id, index: 0 });
    expect(s2.body).toEqual({ songId: s1.body.songId, created: false, merged: false });
    expect((await api('GET', `/songs/${s1.body.songId}`)).body.current_rev).toBe(2);
    expect((await api('POST', `/chats/${t.id}/save`, { messageId: t.messages[0].id })).status).toBe(404); // his own message isn't a reply
    // a lyric with another title in the same chat is another song, not this one's next version
    w.reply = 'Here.\n\n```\nANOTHER ONE\n\n[Chorus]\nsomething else\nentirely\n```';
    await api('POST', '/chats', { threadId: t.id, text: 'now a different song', clientKey: 'c3' }); await svc.idle();
    t = (await api('GET', `/chats/${t.id}`)).body;
    const s3 = await api('POST', `/chats/${t.id}/save`, { messageId: t.messages[5].id, index: 0 });
    expect(s3.body.created).toBe(true);
    expect(s3.body.songId).not.toBe(s1.body.songId);
    expect((await api('GET', `/songs/${s1.body.songId}`)).body.current_rev).toBe(2);
    expect((await api('GET', `/chats/${t.id}`)).body.song_id).toBe(s1.body.songId);
  });

  it('saving a reworked bridge on its own keeps the rest of the song, saved or not yet saved', { timeout: 20000 }, async () => {
    const w = await boot();
    w.reply = 'Here.\n\n```\nSPARE KEY\n\n[Verse 1]\none\ntwo\nthree\nfour\n\n[Chorus]\nfive\nsix\n\n[Bridge]\nseven\neight\n\n[Chorus]\nfive\nsix\n```';
    const r = await api('POST', '/chats', { text: 'write it', clientKey: 'f1' }); await svc.idle();
    w.reply = 'Tighter.\n\n```\nSPARE KEY\n\n[Bridge]\nSEVEN\nEIGHT\n```\n\nOnly the bridge changed.';
    await api('POST', '/chats', { threadId: r.body.threadId, text: 'fix the bridge', clientKey: 'f2' }); await svc.idle();
    let t = (await api('GET', `/chats/${r.body.threadId}`)).body;
    // not saved yet: the bridge goes into the song from earlier in the chat
    const s1 = await api('POST', `/chats/${t.id}/save`, { messageId: t.messages[3].id, index: 0 });
    expect(s1.body).toMatchObject({ created: true, merged: true });
    let song = (await api('GET', `/songs/${s1.body.songId}`)).body;
    expect(text(song)).toBe('[Verse 1]\none\ntwo\nthree\nfour\n\n[Chorus]\nfive\nsix\n\n[Bridge]\nSEVEN\nEIGHT\n\n[Chorus]\nfive\nsix');
    // saved: a new chorus on its own becomes the next version with every chorus changed
    w.reply = '```\nSPARE KEY\n\n[Chorus]\nFIVE\nSIX\n```';
    await api('POST', '/chats', { threadId: t.id, text: 'and the chorus', clientKey: 'f3' }); await svc.idle();
    t = (await api('GET', `/chats/${t.id}`)).body;
    const s2 = await api('POST', `/chats/${t.id}/save`, { messageId: t.messages[5].id, index: 0 });
    expect(s2.body).toEqual({ songId: s1.body.songId, created: false, merged: true });
    song = (await api('GET', `/songs/${s1.body.songId}`)).body;
    expect(song.current_rev).toBe(2);
    expect(text(song)).toBe('[Verse 1]\none\ntwo\nthree\nfour\n\n[Chorus]\nFIVE\nSIX\n\n[Bridge]\nSEVEN\nEIGHT\n\n[Chorus]\nFIVE\nSIX');
  });

  it('a chat about a song sends the song as it stands', { timeout: 20000 }, async () => {
    const w = await boot();
    const { body: song } = await api('POST', '/songs', { title: 'Better For Her', text: '[Chorus]\nThought I was making you better for me\nNot better for her' });
    const r = await api('POST', '/chats', { songId: song.id, text: 'tighten the chorus', clientKey: 'd1' }); await svc.idle();
    expect(w.chats[0].system).toContain('BETTER FOR HER');
    expect(w.chats[0].system).toContain('Not better for her');
    const t = (await api('GET', `/chats/${r.body.threadId}`)).body;
    expect(t.song).toEqual({ id: song.id, title: 'Better For Her' });
    expect((await api('GET', '/chats')).body[0].song_title).toBe('Better For Her');
  });

  it('a failed reply can be tried again without typing it twice; one reply at a time; delete', { timeout: 20000 }, async () => {
    const w = await boot();
    w.failNext = true;
    const r = await api('POST', '/chats', { text: 'a song about leaving', clientKey: 'e1' }); await svc.idle();
    let t = (await api('GET', `/chats/${r.body.threadId}`)).body;
    expect(t.messages).toHaveLength(1);
    expect(t.failed.message).toContain('overloaded');
    const again = await api('POST', '/chats', { threadId: t.id, retry: true, clientKey: 'e2' });
    expect(again.status).toBe(200);
    expect((await api('POST', '/chats', { threadId: t.id, text: 'and another', clientKey: 'e3' })).status).toBe(409);
    await svc.idle();
    t = (await api('GET', `/chats/${t.id}`)).body;
    expect(t.messages.map((m: any) => m.role)).toEqual(['user', 'assistant']);
    expect(t.failed).toBeNull();
    expect(w.chats[1].turns).toEqual([{ role: 'user', text: 'a song about leaving' }]);
    expect((await api('DELETE', `/chats/${t.id}`)).status).toBe(200);
    expect((await api('GET', `/chats/${t.id}`)).status).toBe(404);
  });
});
