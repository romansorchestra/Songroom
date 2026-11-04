// The chat (3 Nov 2026): the app's front door. Type what you want; the reply streams in; any
// lyric in it can be copied or saved to Songs. In a chat about a song, Save makes the song's
// next version. "Remember …" files a standing note he can see under What it remembers.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, clientKey, copy, draftStore } from './api';
import { go, useApp } from './App';
import { Shell } from './Shell';
import { Markdown } from './md';

type Msg = { id: string; role: 'user' | 'assistant'; text: string; run_id: string | null; payload: { remembered?: string[]; savedSongId?: string; saved?: number[] } | null; created_at: string };
type Thread = { id: string; title: string; song_id: string | null; song: { id: string; title: string } | null; messages: Msg[]; pending: { runId: string; text: string } | null; failed: { runId: string; message: string } | null };

const Send = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>;

/** A fenced block worth saving: more than a line or two, or with a section label. */
const isLyric = (t: string) => { const n = t.split('\n').filter((l) => l.trim()).length; return n >= 4 || (n >= 2 && /^\s*\[.+\]\s*$/m.test(t)); };
const norm = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
/** The block's own title (its first line, when that isn't a [Section] label). */
const blockTitle = (t: string) => { const lines = t.split('\n'); const f = lines[0]?.trim() ?? ''; return f && !/^\[.*\]$/.test(f) && lines.length > 2 ? f : ''; };

export function Chat({ id, songId }: { id?: string; songId?: string | null }) {
  const { toast } = useApp();
  const isNew = !id || id === 'new';
  const [thread, setThread] = useState<Thread | null>(null);
  const [song, setSong] = useState<{ id: string; title: string } | null>(null);
  const [live, setLive] = useState<{ runId: string; text: string } | null>(null);
  const [sentText, setSentText] = useState<string | null>(null); // shown at once while a new chat is made
  const [text, setText] = useState(() => draftStore.get(`chat:${id ?? 'new'}`));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);
  const pinned = useRef(false);
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

  async function load(threadId: string) {
    const t = await api<Thread>('GET', `/chats/${threadId}`);
    setThread(t); setSong(t.song); setSentText(null);
    setLive(t.pending);
    return t;
  }

  useEffect(() => {
    setErr(''); setLive(null); setThread(null); setSentText(null); stick.current = true;
    if (!isNew) void load(id!).catch((e) => setErr((e as Error).message));
    else if (songId) void api<{ id: string; title: string }>('GET', `/songs/${songId}`).then((s) => setSong({ id: s.id, title: s.title })).catch(() => setSong(null));
    else setSong(null);
  }, [id, songId]);

  // follow a reply as it is written
  useEffect(() => {
    if (!live || !thread) return;
    let stop = false;
    const tick = async () => {
      while (!stop) {
        await new Promise((r) => setTimeout(r, 450));
        if (stop) return;
        try {
          const p = await api<{ status: string; text: string; error: string | null }>('GET', `/chat-runs/${live.runId}`);
          if (stop) return;
          if (p.status === 'running') setLive((l) => (l && l.runId === live.runId ? { ...l, text: p.text } : l));
          else { await load(thread.id); setRefresh((n) => n + 1); return; }
        } catch { /* a dropped poll is retried */ }
      }
    };
    void tick();
    return () => { stop = true; };
  }, [live?.runId, thread?.id]);

  // follow a reply as it grows, but only until his last message reaches the top of the screen:
  // from there he reads the lyric down from its title instead of chasing the end of it. Once he
  // scrolls himself, leave the page where he put it.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !stick.current) return;
    const bottom = el.scrollHeight - el.clientHeight;
    const mine = el.querySelectorAll<HTMLElement>('.msg.me');
    const last = mine[mine.length - 1];
    const top = last ? last.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 12 : bottom;
    const want = Math.max(0, Math.min(bottom, top));
    pinned.current = want < bottom - 1;
    el.scrollTop = want;
  });
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    // the page pinning his message at the top is not him scrolling away
    if (pinned.current) { pinned.current = false; stick.current = false; return; }
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // the field grows with what he types, up to a point
  useLayoutEffect(() => {
    const f = field.current;
    if (!f) return;
    f.style.height = 'auto';
    f.style.height = `${Math.min(f.scrollHeight, Math.round(window.innerHeight * 0.35))}px`;
  }, [text]);

  async function send(retry = false) {
    const t = text.trim();
    if ((!t && !retry) || busy) return;
    setBusy(true); setErr(''); stick.current = true;
    if (!retry) {
      if (thread) setThread({ ...thread, failed: null, messages: [...thread.messages, { id: `local-${Date.now()}`, role: 'user', text: t, run_id: null, payload: null, created_at: new Date().toISOString() }] });
      else setSentText(t);
      setText(''); draftStore.set(`chat:${id ?? 'new'}`, '');
    } else if (thread) setThread({ ...thread, failed: null });
    try {
      const r = await api<{ threadId: string; runId: string }>('POST', '/chats', { threadId: thread?.id ?? null, songId: thread ? null : song?.id ?? songId ?? null, text: retry ? '' : t, retry, clientKey: clientKey() });
      if (!thread) {
        // the new chat now has an address: open it there (replacing "new" in the history)
        window.location.replace(`#/chat/${r.threadId}`);
        return;
      }
      setLive({ runId: r.runId, text: '' });
    } catch (e) {
      setErr((e as Error).message);
      if (!retry && !thread) { setText(t); setSentText(null); }
    }
    setBusy(false);
  }

  async function save(m: Msg, index: number) {
    if (!thread) return;
    try {
      const r = await api<{ songId: string; created: boolean; merged?: boolean }>('POST', `/chats/${thread.id}/save`, { messageId: m.id, index });
      await load(thread.id);
      toast(r.merged ? (r.created ? 'Saved the whole song to Songs, with this in it' : 'Saved: the song’s new version, with this in it') : r.created ? 'Saved to Songs' : 'Saved as the song’s new version');
    } catch (e) { toast((e as Error).message); }
  }

  async function remove() {
    if (!thread) return;
    if (!confirmDelete) { setConfirmDelete(true); window.setTimeout(() => setConfirmDelete(false), 4000); return; }
    await api('DELETE', `/chats/${thread.id}`).catch(() => {});
    go('/chat/new');
  }

  const messages = thread?.messages ?? [];
  const writing = !!live || busy && !thread;
  const empty = !messages.length && !sentText;

  return (
    <Shell current={thread?.id} refreshKey={refresh} fill>
      <div className="chat">
        {song && (
          <a className="chat-song" href={`#/songs/${song.id}`}>Working on <b>{song.title || 'Untitled'}</b> →</a>
        )}
        <div className="chat-scroll" ref={scroller} onScroll={onScroll}>
          <div className="chat-col">
            {empty && !err && (
              <div className="chat-empty">
                <h1>{song ? `What does “${song.title || 'this song'}” need?` : 'What are we writing?'}</h1>
                <p>Brief it like a co-writer. It knows your taste; say “remember …” to teach it something new.</p>
              </div>
            )}
            {sentText && <div className="msg me"><div className="bubble">{sentText}</div></div>}
            {messages.map((m) => m.role === 'user'
              ? <div key={m.id} className="msg me"><div className="bubble">{m.text}</div></div>
              : (
                <div key={m.id} className="msg them">
                  <Markdown text={m.text} lyricActions={(lyric, i) => (
                    <div className="lyric-actions">
                      <button className="chip-btn" onClick={async () => toast((await copy(lyric)) ? 'Copied' : 'Couldn’t copy')}>Copy</button>
                      {isLyric(lyric) && (m.payload?.saved ?? []).includes(i) && m.payload?.savedSongId
                        ? <a className="chip-btn done" href={`#/songs/${m.payload.savedSongId}`}>Saved ✓ Open</a>
                        : isLyric(lyric) && <button className="chip-btn" onClick={() => save(m, i)}>{thread?.song && !(blockTitle(lyric) && norm(thread.song.title) && norm(blockTitle(lyric)) !== norm(thread.song.title)) ? 'Save as new version' : 'Save to Songs'}</button>}
                    </div>
                  )} />
                  {!!m.payload?.remembered?.length && (
                    <div className="remembered">Remembered: {m.payload.remembered.join(' · ')} <a href="#/memory">See all</a></div>
                  )}
                </div>
              ))}
            {writing && (
              <div className="msg them">
                {live?.text ? <Markdown text={live.text} /> : <Thinking />}
              </div>
            )}
            {thread?.failed && !live && (
              <div className="msg them failed">
                <p>{thread.failed.message}</p>
                <button className="chip-btn" onClick={() => send(true)}>Try again</button>
              </div>
            )}
            {err && <div className="status err" role="alert">{err}</div>}
            {thread && messages.length > 1 && !live && (
              <div className="chat-tail"><button className="link-quiet" onClick={remove}>{confirmDelete ? 'Tap again to delete this chat' : 'Delete this chat'}</button></div>
            )}
          </div>
        </div>
        <form className="composer" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <textarea
            ref={field} rows={1} value={text} aria-label="Message"
            placeholder={messages.length ? 'Reply' : song ? 'What does the song need?' : 'What are we writing?'}
            onChange={(e) => { setText(e.target.value); draftStore.set(`chat:${id ?? 'new'}`, e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !coarse) { e.preventDefault(); void send(); } }}
          />
          <button className="send" aria-label="Send" disabled={!text.trim() || busy || !!live}>{Send}</button>
        </form>
      </div>
    </Shell>
  );
}

/** Before the first words arrive the writer is thinking, sometimes for most of a minute; a clock
 *  says it hasn't stalled. */
function Thinking() {
  const [secs, setSecs] = useState(0);
  useEffect(() => { const t0 = Date.now(); const i = window.setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 1000); return () => window.clearInterval(i); }, []);
  return <div className="thinking" role="status"><span /><span /><span /> Thinking<small aria-hidden="true">{secs >= 5 ? ` · ${secs}s` : ''}</small></div>;
}
