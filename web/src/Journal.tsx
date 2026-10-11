// Journal: the collection of deliberately saved ideas, fragments and songs.
// Not a feed. Each entry opens the thing itself; palettes are the item's own.

import { useEffect, useState } from 'react';
import { api } from './api';
import { palClass, Pending } from './paper';
import { go } from './App';

type Entry = { type: 'idea' | 'fragment' | 'song'; id: string; at: string; palette: string; title: string; text: string; parent?: { id: string; title: string } | null; legacy?: boolean };
const FILTERS: Array<[string, string]> = [['all', 'All'], ['ideas', 'Ideas'], ['fragments', 'Fragments'], ['songs', 'Songs']];

export function Journal() {
  const [filter, setFilter] = useState(() => { try { return sessionStorage.getItem('journal.filter') || 'all'; } catch { return 'all'; } });
  const [q, setQ] = useState('');
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    try { sessionStorage.setItem('journal.filter', filter); } catch { /* fine */ }
    const t = window.setTimeout(() => {
      api<{ entries: Entry[] }>('GET', `/journal?filter=${filter}&q=${encodeURIComponent(q)}`).then((r) => { setEntries(r.entries); setErr(''); }).catch((e) => setErr(e.message));
    }, q ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [filter, q]);

  function open(e: Entry) {
    if (e.type === 'song') go(`/song/${e.id}`);
    else if (e.type === 'idea' || e.legacy) go(`/idea/${e.id}`);
    else if (e.parent?.id.startsWith('song:')) go(`/song/${e.parent.id.slice(5)}`);
    else if (e.parent) go(`/idea/${e.parent.id}`);
  }

  return (
    <div className="pal-ochre">
      <div className="eyebrow">Keep the sparks</div>
      <h2 className="page-title">Your journal.</h2>
      <div className="filters" role="group" aria-label="Show">
        {FILTERS.map(([k, label]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>)}
      </div>
      <input className="line" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your words" aria-label="Search the journal" />
      {err && <div className="status err" role="alert">{err}</div>}
      {!entries && !err && <div style={{ marginTop: 16 }}><Pending text="Opening…" /></div>}
      {entries && !entries.length && (
        <p className="empty-note" style={{ marginTop: 18 }}>{q || filter !== 'all' ? 'Nothing here matches.' : 'Save an idea or a little fragment. It will be waiting here.'}</p>
      )}
      <div>
        {entries?.map((e) => (
          <button key={`${e.type}:${e.id}`} className={`journal-entry ${palClass(e.palette)}`} onClick={() => open(e)}>
            <small>{e.type === 'song' ? 'Song in progress' : e.type === 'idea' ? 'Idea' : e.parent?.title ? `Fragment · ${e.parent.title}` : 'Fragment'}</small>
            {e.type === 'fragment'
              ? <span className={`frag ${e.text.length > 90 ? 'long' : ''}`}>{e.text}</span>
              : <><strong>{e.title || 'Untitled'}</strong>{e.text && <span className="line1">{e.text}</span>}</>}
          </button>
        ))}
      </div>
    </div>
  );
}
