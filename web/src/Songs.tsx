// Songs (3 Nov 2026): the lyrics he has kept, as plain lyric sheets. Open one to read, edit the
// words or the title, copy it, or work on it in a chat (Save there makes its next version).

import { useEffect, useState } from 'react';
import { api, copy, type Section } from './api';
import { go, useApp } from './App';
import { Shell, type ChatRow } from './Shell';
import { LyricSheet } from './md';

type Entry = { type: string; id: string; at: string; title: string; text: string };

const render = (sections: Section[]) => sections.map((s) => (s.label ? `[${s.label}]\n` : '') + s.lines.map((l) => l.text).join('\n')).join('\n\n');

export function SongsList() {
  const [songs, setSongs] = useState<Entry[] | null>(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => {
      void api<Entry[] | { entries: Entry[] }>('GET', `/journal?filter=songs&q=${encodeURIComponent(q)}`)
        .then((r) => setSongs((Array.isArray(r) ? r : r.entries).filter((e) => e.type === 'song')))
        .catch((e) => setErr((e as Error).message));
    }, q ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [q]);
  return (
    <Shell current="songs" title={<span className="bar-name">Songs</span>}>
      <main className="simple-page">
        <input className="line search" placeholder="Search your songs" aria-label="Search your songs" value={q} onChange={(e) => setQ(e.target.value)} />
        {err && <div className="status err" role="alert">{err}</div>}
        {songs?.length === 0 && <p className="muted">{q ? 'Nothing matches.' : 'No songs yet. Save a lyric from a chat and it lands here.'}</p>}
        <div className="song-list">
          {songs?.map((s) => (
            <a key={s.id} className="song-row" href={`#/songs/${s.id}`}>
              <span className="t">{s.title || 'Untitled'}</span>
              <span className="l">{s.text}</span>
            </a>
          ))}
        </div>
      </main>
    </Shell>
  );
}

type Song = { id: string; title: string; current_rev: number; sections: Section[]; updated_at: string };

export function SongPage({ id }: { id: string }) {
  const { toast } = useApp();
  const [song, setSong] = useState<Song | null>(null);
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const s = await api<Song>('GET', `/songs/${id}`);
    setSong(s); setTitle(s.title); setText(render(s.sections));
  }
  useEffect(() => {
    void load().catch((e) => setErr((e as Error).message));
    void api<ChatRow[]>('GET', '/chats').then((c) => setChats(c.filter((x) => x.song_id === id))).catch(() => {});
  }, [id]);

  async function save() {
    if (!song) return;
    setBusy(true); setErr('');
    try {
      if (title.trim() !== song.title) await api('PATCH', `/songs/${id}`, { title: title.trim() });
      if (text !== render(song.sections)) await api('PUT', `/songs/${id}/text`, { baseRev: song.current_rev, text });
      await load(); setEditing(false); toast('Saved');
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  if (err && !song) return <Shell current="songs"><main className="simple-page"><div className="status err" role="alert">{err}</div></main></Shell>;
  if (!song) return <Shell current="songs"><main className="simple-page" /></Shell>;
  const lyric = render(song.sections);

  return (
    <Shell current="songs" title={<a className="bar-name" href="#/songs">‹ Songs</a>}>
      <main className="simple-page">
        {editing ? (
          <>
            <input className="line title-field" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" placeholder="Title" />
            <textarea className="lyric-edit" value={text} onChange={(e) => setText(e.target.value)} aria-label="Lyric" rows={Math.max(12, text.split('\n').length + 2)} />
            {err && <div className="status err" role="alert">{err}</div>}
            <div className="song-actions">
              <button className="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
              <button className="secondary" disabled={busy} onClick={() => { setEditing(false); setTitle(song.title); setText(lyric); setErr(''); }}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <h1 className="song-title">{song.title || 'Untitled'}</h1>
            <div className="song-actions">
              <button className="primary" onClick={() => go(`/chat/new?song=${id}`)}>Work on it</button>
              <button className="secondary" onClick={() => setEditing(true)}>Edit</button>
              <button className="secondary" onClick={async () => toast((await copy(`${song.title}\n\n${lyric}`)) ? 'Copied' : 'Couldn’t copy')}>Copy</button>
            </div>
            {lyric.trim() ? <LyricSheet text={lyric} /> : <p className="muted">No words yet. Tap Edit, or Work on it.</p>}
            {chats.length > 0 && (
              <div className="song-chats">
                <div className="drawer-head">Chats about this song</div>
                {chats.map((c) => <a key={c.id} className="song-row" href={`#/chat/${c.id}`}><span className="t">{c.title || 'Chat'}</span></a>)}
              </div>
            )}
            <p className="small muted" style={{ marginTop: 28 }}><a href={`#/song/${id}`}>Open in the detailed editor</a></p>
          </>
        )}
      </main>
    </Shell>
  );
}
