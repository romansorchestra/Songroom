import { useEffect, useState } from 'react';
import { api, type Section } from './api';
import { Motif, timeAgo } from './bits';
import { go } from './App';

type IdeaRow = { id: string; kind: 'seed' | 'line'; title: string; concept: string; lines: Array<{ text: string }>; starred: boolean; motif: number; updated_at: string };
type SongRow = { id: string; title: string; brief: string; starred: boolean; motif: number; updated_at: string; sections: Section[] };

const FILTERS: Array<[string, string]> = [['all', 'Everything'], ['songs', 'Songs'], ['seeds', 'Seeds'], ['lines', 'Lines'], ['starred', 'Starred']];

export function Journal() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [data, setData] = useState<{ ideas: IdeaRow[]; songs: SongRow[] } | null>(null);
  const [err, setErr] = useState('');
  const [newSong, setNewSong] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      api('GET', `/journal?q=${encodeURIComponent(q)}&filter=${filter}`).then((d) => { setData(d); setErr(''); }).catch((e) => setErr(e.message));
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, filter]);

  const items = [
    ...(data?.songs ?? []).map((s) => ({ type: 'song' as const, at: s.updated_at, s })),
    ...(data?.ideas ?? []).map((i) => ({ type: 'idea' as const, at: i.updated_at, i })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 30 }}>Journal</h1>
        <button className="btn quiet sm" onClick={() => setNewSong(true)}>New song</button>
      </div>
      {newSong && <NewSong onClose={() => setNewSong(false)} />}
      <div style={{ marginTop: 12 }}>
        <input type="text" placeholder="Search titles, lines and notes" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="filters" role="group" aria-label="Filter">
        {FILTERS.map(([k, label]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>)}
      </div>
      {err && <div className="error">{err}</div>}
      {data && !items.length && (
        <div className="empty muted">{q || filter !== 'all' ? 'Nothing matches.' : 'Nothing saved yet. Save an idea from Write, or start a song.'}</div>
      )}
      <div className="pages">
        {items.map((it) => it.type === 'song' ? (
          <a key={it.s.id} className="page-link" href={`#/song/${it.s.id}`}>
            <article className="sheet">
              <Motif n={it.s.motif} />
              <div className="kind">{it.s.starred ? '★ ' : ''}Song, edited {timeAgo(it.s.updated_at)}</div>
              <h2 className="title">{it.s.title || 'Untitled'}</h2>
              <div className="lyrics clip">{it.s.sections.flatMap((x) => x.lines.map((l) => l.text)).slice(0, 4).join('\n') || it.s.brief}</div>
            </article>
          </a>
        ) : (
          <a key={it.i.id} className="page-link" href={`#/idea/${it.i.id}`}>
            <article className="sheet">
              <Motif n={it.i.motif} />
              <div className="kind">{it.i.starred ? '★ ' : ''}{it.i.kind === 'line' ? 'Line' : 'Seed'}, saved {timeAgo(it.i.updated_at)}</div>
              {it.i.kind === 'seed' && <h2 className="title">{it.i.title || 'Untitled'}</h2>}
              {it.i.kind === 'seed' && it.i.concept && <p className="concept clip">{it.i.concept}</p>}
              <div className="lyrics clip">{it.i.lines.map((l) => l.text).join('\n')}</div>
            </article>
          </a>
        ))}
      </div>
    </>
  );
}

function NewSong({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function create() {
    setBusy(true);
    try { const s = await api('POST', '/songs', { title, text }); go(`/song/${s.id}`); } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <div className="editsheet" style={{ marginTop: 12 }}>
      <input type="text" placeholder="Title" aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea rows={8} placeholder={'Paste or type lyrics (optional).\n[Verse 1], [Chorus] etc. become sections.'} aria-label="Lyrics" value={text} onChange={(e) => setText(e.target.value)} />
      {err && <div className="error">{err}</div>}
      <div className="row"><button className="btn" disabled={busy} onClick={create}>Create song</button><button className="btn quiet" onClick={onClose}>Cancel</button></div>
    </div>
  );
}
