// Browse: ten titles at once (11 Oct 2026, late). Sam: "How am I supposed to just generate
// and browse a bunch of ideas that are just good relationship titles (with a concept and a
// few lines)". Each card is a title, its concept and the part of the chorus where the title
// lands; tap one and it opens on the Write screen, where it can be marked, reworked or made
// into a page. Lists stay here, newest first, for the genre they were written to.

import { useCallback, useEffect, useState } from 'react';
import { api, clientKey, waitForRun } from './api';
import { Pending, palClass } from './paper';
import { go, useApp } from './App';

type Card = { id: string; title: string; title_parts: string[] | null; concept: string; lines: Array<{ id: string; text: string }>; palette: string; subject: string | null; saved: boolean };
type Page = {
  direction: { text: string; refId: string | null; genre?: string }; genres: Array<{ id: string; label: string }>;
  batches: Array<{ id: string; created_at: string; ideas: Card[] }>; runId: string | null; lastError: string | null;
  writer: { connected: boolean; live: boolean };
};

export function Browse() {
  const { toast } = useApp();
  const [page, setPage] = useState<Page | null>(null);
  const [err, setErr] = useState('');
  const [run, setRun] = useState<string | null>(null);
  const [runErr, setRunErr] = useState('');
  const [scope, setScope] = useState<'relationship' | 'all'>('relationship');

  const load = useCallback(async () => {
    try { const p = await api<Page>('GET', '/browse'); setPage(p); setErr(''); if (p.runId) setRun(p.runId); } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!run) return;
    let stop = false;
    (async () => {
      try {
        const r = await waitForRun(run);
        if (stop) return;
        setRunErr(r.status === 'succeeded' ? '' : (r.error?.message ?? 'That didn’t work.'));
      } catch (e) { if (!stop) setRunErr((e as Error).message); }
      if (!stop) { setRun(null); await load(); }
    })();
    return () => { stop = true; };
  }, [run, load]);

  async function more() {
    if (run) return;
    setRunErr('');
    try { const r = await api<{ runId: string }>('POST', '/browse/list', { clientKey: clientKey(), scope }); setRun(r.runId); }
    catch (e) { setRunErr((e as Error).message); }
  }
  async function open(id: string) {
    try { await api('POST', '/springboard/current', { ideaId: id }); go('/write'); } catch (e) { toast((e as Error).message); }
  }
  async function setGenre(genre: string) {
    try { await api('PUT', '/springboard/direction', { genre }); await load(); } catch (e) { toast((e as Error).message); }
  }

  if (err) return <div className="status err" role="alert">{err} <button className="tb under" onClick={load}>Retry</button></div>;
  if (!page) return <Pending text="Opening…" />;
  const cur = page.direction.genre || 'pop';
  const count = page.batches.reduce((n, b) => n + b.ideas.length, 0);
  const button = (
    <button className="primary big-new" disabled={!page.writer.connected || !!run} onClick={more}>
      {run ? 'Writing ten titles…' : count ? 'Ten more titles' : 'Give me ten titles'}
    </button>
  );
  return (
    <div className="pal-ochre browse">
      <div className="genres" role="group" aria-label="Titles for">
        <span className="eyebrow">Titles for</span>
        {page.genres.map((g) => <button key={g.id} aria-pressed={cur === g.id} onClick={() => cur !== g.id && setGenre(g.id)}>{g.label}</button>)}
      </div>
      <div className="genres" role="group" aria-label="About">
        <span className="eyebrow">About</span>
        <button aria-pressed={scope === 'relationship'} onClick={() => setScope('relationship')}>Relationships</button>
        <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>The chart mix</button>
      </div>
      <div className="topline"><span className="eyebrow">Browse</span></div>
      <h2 className="page-title">Ten titles at a time.</h2>
      <p className="concept">Each one with the feeling behind it and the part of the chorus where the title lands: some open on it, some end on it, some say it in passing. Tap one to work on it.{page.direction.text ? <> Your direction (“{page.direction.text.split('\n')[0]}”) steers them.</> : null}</p>
      {button}
      <div className="status" role="status" aria-live="polite">{run ? <Pending text="Writing ten titles… about a minute." /> : runErr || page.lastError || ''}</div>
      {!count && !run && <p className="empty-note">Nothing here yet for {page.genres.find((g) => g.id === cur)?.label ?? 'this genre'}.</p>}
      {page.batches.map((b, bi) => (
        <section key={b.id} className="browse-batch">
          <div className="eyebrow">{bi === 0 ? 'Newest' : when(b.created_at)}</div>
          {b.ideas.map((c) => (
            <button key={c.id} className={`browse-card ${palClass(c.palette)}`} onClick={() => open(c.id)} aria-label={`Open ${c.title}`}>
              <strong className="browse-title">{c.title}</strong>
              {c.concept && <span className="browse-concept">{c.concept}</span>}
              <span className="browse-lines">{c.lines.map((l) => l.text).join('\n')}</span>
              <span className="browse-open">Work on it ↗</span>
            </button>
          ))}
        </section>
      ))}
      {count > 0 && <div style={{ marginTop: 18 }}>{button}</div>}
    </div>
  );
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
