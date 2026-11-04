// The chat (3 Nov 2026): the app's front door. He types what he wants, the writer answers in
// plain text, streamed, with his memory behind it; a lyric in a reply can be saved to Songs (or,
// in a chat about a song, saved as that song's next version). "Remember …" files a standing
// lesson he can see and delete in Settings. Conversations are threads of kind 'chat'.

import { Service, AppError, MAX_TOKENS } from './service.js';
import { newId, renderLyrics, parseLyrics, type Section } from './engine/lyrics.js';
import { chatSystem, CHAT_TEMPLATE } from './engine/prompts.js';
import { WriterError } from './engine/writer.js';

type Msg = { id: string; role: 'user' | 'assistant'; text: string; run_id: string | null; payload: Record<string, unknown> | null; created_at: string };

const REMEMBER = /^[ \t]*\[\[remember:\s*(.+?)\s*\]\][ \t]*$/gim;
const MAX_TURNS = 40;
const MAX_HISTORY_CHARS = 60000;

/** A lyric in a reply: the nth fenced block, its first line the title when it isn't a section label. */
export function lyricFrom(text: string, index = 0): { title: string; lyric: string } | null {
  const m = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)][index];
  if (!m) return null;
  const lines = m[1].replace(/\s+$/, '').split('\n');
  let title = '';
  const first = lines[0]?.trim() ?? '';
  if (first && !/^\[.*\]$/.test(first) && lines.length > 2) {
    title = first.replace(/^#+\s*/, '').replace(/\*+/g, '').trim();
    lines.shift();
  }
  const lyric = lines.join('\n').replace(/^\n+/, '');
  if (lyric.split('\n').filter((l) => l.trim()).length < 2) return null;
  // ALL CAPS titles read better saved in title case
  if (title && title === title.toUpperCase()) title = title.toLowerCase().replace(/(^|[\s(“"'-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
  return { title, lyric };
}

/** Whether a lyric's title names the song a chat is about: false only when both have titles and they differ. */
export function sameSong(songTitle: string, lyricTitle: string): boolean | null {
  const n = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (!n(songTitle) || !n(lyricTitle)) return null;
  return n(songTitle) === n(lyricTitle);
}

/** Every fenced block in a reply, counted the way the screen counts them. */
function blockCount(text: string): number {
  return [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].length;
}

/** A block that rewrites only part of a song ([Bridge] alone, say) goes back into the whole song:
 *  each section it gives replaces every section with that label (a chorus that changes changes
 *  each time it comes round) and the rest stays as it was. Null when the block isn't a part of
 *  that song: it gives a section the song hasn't got, or it is most of the song (a new version
 *  that drops the outro is still a new version, not a patch). */
export function mergeInto(whole: string, part: string): string | null {
  const base = parseLyrics(whole), bits = parseLyrics(part);
  const key = (label: string) => label.trim().toLowerCase();
  if (!base.length || !bits.length || bits.some((b) => !b.label)) return null;
  const labels = new Set(base.map((x) => key(x.label)));
  if (!bits.every((b) => labels.has(key(b.label)))) return null;
  const count = (xs: Section[]) => xs.reduce((n, x) => n + x.lines.length, 0);
  if (count(bits) >= 0.6 * count(base)) return null;
  const by = new Map(bits.map((b) => [key(b.label), b]));
  return renderLyrics(base.map((x) => { const b = by.get(key(x.label)); return b ? { ...x, lines: b.lines } : x; }));
}

export class Chat {
  /** What the running reply in each chat has written so far (chat id → text), shown as it arrives.
   *  One reply runs per chat at a time, so the chat id is the key. */
  private live = new Map<string, string>();
  constructor(private svc: Service) {}
  private get db() { return this.svc.db; }

  async list() {
    return this.db.query(`SELECT t.id, t.title, t.song_id, s.title AS song_title, t.updated_at FROM threads t LEFT JOIN songs s ON s.id=t.song_id
      WHERE t.kind='chat' ORDER BY t.updated_at DESC LIMIT 60`);
  }

  async get(id: string) {
    const [t] = await this.db.query<{ id: string; title: string; song_id: string | null; updated_at: string }>(`SELECT id, title, song_id, updated_at FROM threads WHERE id=$1 AND kind='chat'`, [id]);
    if (!t) throw new AppError(404, 'not_found', 'That chat has gone.');
    const messages = await this.db.query<Msg>(`SELECT id, role, text, run_id, payload, created_at FROM messages WHERE thread_id=$1 ORDER BY created_at, rowid`, [id]);
    const [run] = await this.db.query<{ id: string; status: string; error: { message?: string } | null }>(`SELECT id, status, error FROM runs WHERE thread_id=$1 AND task='chat' ORDER BY rowid DESC LIMIT 1`, [id]);
    const answered = !!run && messages.some((m) => m.run_id === run.id);
    const song = t.song_id ? (await this.db.query<{ id: string; title: string }>(`SELECT id, title FROM songs WHERE id=$1`, [t.song_id]))[0] ?? null : null;
    return {
      ...t, song, messages,
      pending: run && run.status === 'running' ? { runId: run.id, text: this.live.get(id) ?? '' } : null,
      failed: run && !answered && run.status !== 'running' && run.status !== 'succeeded' ? { runId: run.id, message: run.error?.message ?? 'That reply didn’t finish.' } : null,
    };
  }

  /** The reply as it is being written. */
  async progress(runId: string) {
    const [r] = await this.db.query<{ status: string; error: { message?: string } | null; thread_id: string | null }>(`SELECT status, error, thread_id FROM runs WHERE id=$1 AND task='chat'`, [runId]);
    if (!r) throw new AppError(404, 'not_found', 'Not found.');
    return { status: r.status, text: r.thread_id ? this.live.get(r.thread_id) ?? '' : '', error: r.error?.message ?? null };
  }

  async remove(id: string) {
    await this.db.query(`UPDATE runs SET status='cancelled' WHERE thread_id=$1 AND status='running'`, [id]);
    await this.db.query(`DELETE FROM threads WHERE id=$1 AND kind='chat'`, [id]);
    this.live.delete(id);
    return { ok: true };
  }

  /** Send a message (or, with retry, ask again for the last one) and start the reply. */
  async send(input: { threadId: string | null; songId?: string | null; text: string; clientKey: string | null; retry?: boolean }) {
    const writer = this.svc.writer;
    if (!writer?.chat) throw new AppError(503, 'no_writer', 'No writer is connected. Add the Anthropic API key in Render to write.');
    let threadId = input.threadId;
    let songId = input.songId ?? null;
    const text = input.text.trim();
    if (!input.retry && !text) throw new AppError(400, 'empty', 'Type something first.');
    if (threadId) {
      const [t] = await this.db.query<{ song_id: string | null }>(`SELECT song_id FROM threads WHERE id=$1 AND kind='chat'`, [threadId]);
      if (!t) throw new AppError(404, 'not_found', 'That chat has gone.');
      songId = t.song_id;
      const [busy] = await this.db.query(`SELECT id FROM runs WHERE thread_id=$1 AND task='chat' AND status='running'`, [threadId]);
      if (busy) throw new AppError(409, 'busy', 'Still writing the last reply.');
    } else {
      if (input.retry) throw new AppError(400, 'nothing', 'Nothing to try again.');
      if (songId) {
        const [s] = await this.db.query(`SELECT id FROM songs WHERE id=$1`, [songId]);
        if (!s) throw new AppError(404, 'not_found', 'Song not found.');
      }
      threadId = newId('t_');
      const title = text.replace(/\s+/g, ' ').slice(0, 60);
      await this.db.query(`INSERT INTO threads(id, title, song_id, kind) VALUES ($1,$2,$3,'chat')`, [threadId, title, songId]);
    }
    if (!input.retry) await this.db.query(`INSERT INTO messages(id, thread_id, role, text, payload) VALUES ($1,$2,'user',$3,$4)`, [newId('m_'), threadId, text, JSON.stringify({})]);
    await this.db.query(`UPDATE threads SET updated_at=now() WHERE id=$1`, [threadId]);

    // the conversation, oldest first, same-role neighbours merged (a failed reply leaves two of his in a row)
    const rows = (await this.db.query<Msg>(`SELECT id, role, text, run_id, payload, created_at FROM messages WHERE thread_id=$1 ORDER BY created_at DESC, rowid DESC LIMIT ${MAX_TURNS}`, [threadId])).reverse();
    const turns: Array<{ role: 'user' | 'assistant'; text: string }> = [];
    for (const m of rows) {
      const last = turns[turns.length - 1];
      if (last && last.role === m.role) last.text += `\n\n${m.text}`;
      else turns.push({ role: m.role, text: m.text });
    }
    while (turns.length && turns[0].role !== 'user') turns.shift();
    let size = turns.reduce((n, t) => n + t.text.length, 0);
    while (turns.length > 1 && size > MAX_HISTORY_CHARS) { size -= turns[0].text.length + (turns[1]?.text.length ?? 0); turns.splice(0, 2); }
    if (!turns.length || turns[turns.length - 1].role !== 'user') throw new AppError(400, 'nothing', 'Nothing to answer.');
    const lastText = turns[turns.length - 1].text;

    let song: { title: string; lyrics: string } | null = null;
    if (songId) {
      const [s] = await this.db.query<{ title: string; sections: Section[] }>(`SELECT s.title, r.sections FROM songs s JOIN song_revisions r ON r.song_id=s.id AND r.rev=s.current_rev WHERE s.id=$1`, [songId]);
      if (s) song = { title: s.title, lyrics: renderLyrics(s.sections) };
    }
    const memory = await this.svc.tasteFor(lastText);
    const system = chatSystem({ memory, song });
    const s = await this.svc.settings();
    const tid = threadId;
    const run = await this.svc.startRun({
      task: 'chat', threadId: tid, songId, clientKey: input.clientKey, effort: s.effortCreative, promptVersion: CHAT_TEMPLATE,
      request: { turns: turns.length, songId, memoryChars: memory.length, retry: !!input.retry },
      inputChars: system.length + turns.reduce((n, t) => n + t.text.length, 0),
      exec: async (signal, model) => {
        this.live.set(tid, '');
        const r = await writer.chat!({ system, turns, effort: s.effortCreative, maxTokens: MAX_TOKENS.chat, model, signal, webSearches: writer.live ? 2 : 0 },
          (d) => this.live.set(tid, (this.live.get(tid) ?? '') + d));
        if (!r.text.trim()) throw new WriterError('bad_output', 'The writer came back with nothing. Try again.', r.usage);
        return { result: { text: r.text, truncated: r.truncated } as Record<string, unknown>, usage: r.usage, requestId: r.requestId, model: r.model, live: r.live };
      },
      onSuccess: async (runId, result) => {
        const raw = String(result.text ?? '');
        const remembered: string[] = [];
        for (const m of raw.matchAll(REMEMBER)) remembered.push(m[1].trim());
        const shown = raw.replace(REMEMBER, '').replace(/\n{3,}/g, '\n\n').trim() + (result.truncated ? '\n\n_(Cut off: it ran out of room. Ask it to carry on.)_' : '');
        const saved: string[] = [];
        for (const r of remembered.slice(0, 3)) {
          const l = await this.svc.lessons.add(r, 'chat', { note: lastText.slice(0, 300), scope: 'standing' });
          if (l) saved.push(l.text);
        }
        // a chat whose first reply is a song is listed by the song's title, not his first sentence
        const first = !(await this.db.query(`SELECT 1 FROM messages WHERE thread_id=$1 AND role='assistant' LIMIT 1`, [tid])).length;
        const named = first ? lyricFrom(shown)?.title ?? '' : '';
        await this.db.query(`INSERT INTO messages(id, thread_id, role, text, run_id, payload) VALUES ($1,$2,'assistant',$3,$4,$5)`,
          [newId('m_'), tid, shown, runId, JSON.stringify(saved.length ? { remembered: saved } : {})]);
        if (named) await this.db.query(`UPDATE threads SET updated_at=now(), title=$2 WHERE id=$1`, [tid, named.slice(0, 80)]);
        else await this.db.query(`UPDATE threads SET updated_at=now() WHERE id=$1`, [tid]);
      },
    });
    return { threadId: tid, runId: run.id };
  }

  /** Save a reply's lyric: a new song, or the next version of the song this chat is about. */
  async save(threadId: string, messageId: string, index = 0) {
    const [m] = await this.db.query<Msg>(`SELECT id, role, text, run_id, payload, created_at FROM messages WHERE id=$1 AND thread_id=$2 AND role='assistant'`, [messageId, threadId]);
    if (!m) throw new AppError(404, 'not_found', 'Not found.');
    const got = lyricFrom(m.text, index);
    if (!got) throw new AppError(400, 'no_lyric', 'There’s no lyric in that reply to save.');
    if (!parseLyrics(got.lyric).length) throw new AppError(400, 'no_lyric', 'There’s no lyric in that reply to save.');
    const [t] = await this.db.query<{ song_id: string | null }>(`SELECT song_id FROM threads WHERE id=$1`, [threadId]);
    let songId = t?.song_id ?? null;
    let created = false, merged = false;
    if (songId) {
      const [s] = await this.db.query<{ current_rev: number; title: string; sections: Section[] }>(`SELECT s.current_rev, s.title, r.sections FROM songs s JOIN song_revisions r ON r.song_id=s.id AND r.rev=s.current_rev WHERE s.id=$1`, [songId]);
      // a lyric with a different title is a different song, not this one's next version
      if (!s || sameSong(s.title, got.title) === false) songId = null;
      else {
        // a reworked bridge on its own is saved into the song, not over it
        const whole = mergeInto(renderLyrics(s.sections), got.lyric);
        merged = whole !== null;
        await this.svc.saveText(songId, s.current_rev, whole ?? got.lyric);
        if (got.title && !s.title.trim()) await this.svc.updateSong(songId, { title: got.title });
      }
    }
    if (!songId) {
      // not saved yet: a part goes into the whole song it belongs to, from earlier in this chat
      let text = got.lyric;
      const earlier = await this.db.query<Msg>(`SELECT id, role, text, run_id, payload, created_at FROM messages WHERE thread_id=$1 AND role='assistant' AND rowid<=(SELECT rowid FROM messages WHERE id=$2) ORDER BY rowid DESC`, [threadId, m.id]);
      find: for (const e of earlier) {
        for (let i = blockCount(e.text) - 1; i >= 0; i--) {
          if (e.id === m.id && i >= index) continue;
          const b = lyricFrom(e.text, i);
          if (!b || sameSong(b.title, got.title) === false) continue;
          const whole = mergeInto(b.lyric, got.lyric);
          if (whole) { text = whole; merged = true; break find; }
        }
      }
      const song = await this.svc.createSong({ title: got.title || 'Untitled', text }) as { id: string };
      songId = song.id;
      created = true;
      await this.db.query(`UPDATE threads SET song_id=$2 WHERE id=$1 AND song_id IS NULL`, [threadId, songId]);
    }
    const payload = { ...(m.payload ?? {}), savedSongId: songId, saved: [...new Set([...(((m.payload ?? {}) as { saved?: number[] }).saved ?? []), index])] };
    await this.db.query(`UPDATE messages SET payload=$2 WHERE id=$1`, [m.id, JSON.stringify(payload)]);
    return { songId, created, merged };
  }
}
