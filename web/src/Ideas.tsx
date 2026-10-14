// Ideas (14 Oct 2026, the simplification plan): the default home. One idea, close to the
// top: title, concept, a few seed lines. Another idea; Save; Start writing; Add a thought;
// Previous and history. A small "For you" selector sets the direction for the next idea.
// Everything directed (a brief, a reference, reworking an idea to a note, ten titles at
// once, a song already in progress) lives on Create. Also opens a saved idea (#/idea/:id).

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, clientKey, draftStore, waitForRun } from './api';
import { TitleStrips, FragmentList, Composer, Pending, Overlay, palClass, type Fragment } from './paper';
import { RefChecker, refSummary, type Ref } from './Direction';
import { Menu } from './bits';
import { go, useApp } from './App';

export type Idea = {
  id: string; title: string; title_parts: string[] | null; concept: string; lines: Array<{ id: string; text: string }>;
  palette: string; saved: boolean; pending: string; note: string; notes: string; origin: string; kind: string;
  fragments: Fragment[]; song: { id: string; title: string } | null; shown_at: string | null;
  parent_id?: string | null; feedback?: string;
};
type Board = {
  direction: { text: string; refId: string | null; genre?: string }; reference: Ref | null; current: Idea | null;
  prevId: string | null; nextId: string | null; queued: number; number: number; runId: string | null; lastError: string | null;
  reworkRunId?: string | null; prefetching?: boolean; genres?: Array<{ id: string; label: string }>;
  writer: { connected: boolean; live: boolean };
};

export function Ideas({ ideaId }: { ideaId?: string }) {
  const journalMode = !!ideaId;
  const { toast } = useApp();
  const [board, setBoard] = useState<Board | null>(null);
  const [idea, setIdea] = useState<Idea | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [genRun, setGenRun] = useState<string | null>(null);
  const [genErr, setGenErr] = useState('');
  const [status, setStatus] = useState<{ text: string; err?: boolean; retry?: () => void } | null>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const [dirOpen, setDirOpen] = useState(false);
  const [thoughtOpen, setThoughtOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      if (journalMode) { setIdea(await api<Idea>('GET', `/ideas/${ideaId}`)); }
      else { const b = await api<Board>('GET', '/springboard'); setBoard(b); setIdea(b.current); if (b.runId) setGenRun(b.runId); }
      setLoadErr('');
    } catch (e) { setLoadErr((e as Error).message); }
  }, [ideaId, journalMode]);
  useEffect(() => { void load(); }, [load]);

  // Follow a generation in flight (also after a reload). The idea on screen stays usable meanwhile.
  useEffect(() => {
    if (!genRun) return;
    let stop = false;
    (async () => {
      try {
        const run = await waitForRun(genRun);
        if (stop) return;
        if (run.status !== 'succeeded') setGenErr(run.error?.message ?? 'That didn’t work. Your current idea is unchanged.');
        else setGenErr('');
      } catch (e) { if (!stop) setGenErr((e as Error).message); }
      if (!stop) { setGenRun(null); await load(); }
    })();
    return () => { stop = true; };
  }, [genRun, load]);

  // ---- a thought: his exact words, kept as a fragment; typed text survives navigation ----
  const [pending, setPending] = useState('');
  const pendFor = useRef<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!idea) return;
    if (pendFor.current !== idea.id) {
      pendFor.current = idea.id;
      const t = draftStore.get(`frag:${idea.id}`) || idea.pending || '';
      setPending(t);
      if (t) setThoughtOpen(true);
    }
  }, [idea?.id]);
  function onPending(v: string) {
    if (!idea) return;
    setPending(v);
    draftStore.set(`frag:${idea.id}`, v);
  }
  const [adding, setAdding] = useState(false);
  async function addThought() {
    if (!idea || !pending.trim()) return;
    setAdding(true);
    const text = pending;
    try {
      const f = await api<Fragment>('POST', '/fragments', { ideaId: idea.id, text, clientKey: `${idea.id}:${hash(text)}:${idea.fragments.length}` });
      setIdea({ ...idea, fragments: [...idea.fragments, f], pending: '' });
      setPending(''); draftStore.set(`frag:${idea.id}`, '');
      void api('PATCH', `/ideas/${idea.id}`, { pending: '' }).catch(() => {});
      setStatus({ text: 'Kept with this idea.' });
      composerRef.current?.focus();
    } catch (e) {
      const ae = e as ApiError;
      setStatus({ text: ae.status === 0 ? 'Couldn’t reach Songroom. Your words are still here.' : ae.message, err: true, retry: addThought });
    }
    setAdding(false);
  }
  async function saveFragment(f: Fragment) {
    if (!idea || f.saved) return;
    try {
      const out = await api<Fragment>('PATCH', `/fragments/${f.id}`, { saved: true });
      setIdea({ ...idea, fragments: idea.fragments.map((x) => (x.id === f.id ? out : x)) });
      setStatus({ text: 'Thought saved to your Journal.' });
    } catch (e) { setStatus({ text: (e as Error).message, err: true, retry: () => saveFragment(f) }); }
  }
  async function removeFragment(f: Fragment) {
    if (!idea) return;
    if (f.saved && !confirm('This thought is in your Journal. Remove it everywhere?')) return;
    try { await api('DELETE', `/fragments/${f.id}`); setIdea({ ...idea, fragments: idea.fragments.filter((x) => x.id !== f.id) }); }
    catch (e) { setStatus({ text: (e as Error).message, err: true }); }
  }

  // ---- actions ----
  async function another() {
    if (genRun) return;
    setGenErr(''); setStatus(null);
    if (board?.nextId) { await move(board.nextId); return; }
    try {
      const r = await api<{ shown: boolean; runId?: string } & Partial<Board>>('POST', '/springboard/next', { clientKey: clientKey() });
      if (r.shown) { setBoard(r as Board); setIdea((r as Board).current); window.scrollTo(0, 0); }
      else if (r.runId) setGenRun(r.runId);
    } catch (e) { setGenErr((e as Error).message); }
  }
  async function move(id: string) {
    try { const b = await api<Board>('POST', '/springboard/current', { ideaId: id }); setBoard(b); setIdea(b.current); setStatus(null); window.scrollTo(0, 0); }
    catch (e) { toast((e as Error).message); }
  }
  async function saveIdea() {
    if (!idea || idea.saved) return;
    setStatus({ text: 'Saving…' });
    try { const out = await api<Idea>('PATCH', `/ideas/${idea.id}`, { saved: true }); setIdea(out); setStatus({ text: 'Saved to your Journal.' }); }
    catch (e) { setStatus({ text: `Couldn’t save: ${(e as Error).message}`, err: true, retry: saveIdea }); }
  }
  const [starting, setStarting] = useState(false);
  async function startWriting() {
    if (!idea || starting) return;
    setStarting(true);
    try { const r = await api<{ songId: string }>('POST', `/ideas/${idea.id}/start`); go(`/song/${r.songId}`); }
    catch (e) { setStatus({ text: (e as Error).message, err: true, retry: startWriting }); setStarting(false); }
  }
  async function setDirection(patch: { genre?: string; text?: string; refId?: string | null }) {
    try { await api('PUT', '/springboard/direction', patch); await load(); }
    catch (e) { toast((e as Error).message); }
  }

  if (loadErr) return <div className="status err" role="alert">{loadErr} <button className="tb under" onClick={load}>Retry</button></div>;
  if (!idea && !board) return <Pending text="Opening…" />;
  const writerOk = journalMode || (board?.writer.connected ?? false);
  const busy = !!genRun;

  // ---- empty state ----
  if (!idea && board) {
    return (
      <div className="pal-ochre ideas">
        <ForYou board={board} onOpen={() => setDirOpen(true)} />
        <h2 className="page-title" style={{ marginTop: 10 }}>Let’s find a song.</h2>
        <p className="concept">One idea at a time: a title, the feeling behind it, and a first few lines.</p>
        <button className="primary big-new" disabled={!writerOk || busy} onClick={another}>{genRun ? 'Writing…' : 'Give me an idea'}</button>
        <div className="status" role="status" aria-live="polite">{genRun ? <Pending text="Writing an idea…" /> : genErr || board.lastError || ''}</div>
        {dirOpen && <DirectionSheet board={board} onClose={() => setDirOpen(false)} onSave={setDirection} />}
      </div>
    );
  }
  if (!idea) return null;

  return (
    <div className={`${palClass(idea.palette)} ideas`}>
      {journalMode
        ? <div className="topline"><a className="tb under" style={{ paddingLeft: 0 }} href="#/journal">← Journal</a><span className="eyebrow">{idea.saved ? 'Saved idea' : 'Idea'}</span></div>
        : <div className="topline">
            <ForYou board={board!} onOpen={() => setDirOpen(true)} />
            {board?.number ? <span className="serial" aria-label={`Idea number ${board.number}`}>no. {String(board.number).padStart(2, '0')}</span> : null}
          </div>}

      <TitleStrips title={idea.title} parts={idea.title_parts} />
      {idea.concept && <p className="concept">{idea.concept}</p>}
      {!!idea.lines.length && (
        <div className="seed">
          <div className="eyebrow">A first few lines</div>
          <p className="seed-lines">{idea.lines.map((l) => l.text).join('\n')}</p>
        </div>
      )}

      {!journalMode && (
        <button className="primary big-new" disabled={(!writerOk && !board?.nextId) || busy} onClick={another}>
          {genRun ? 'Writing another idea…' : board?.nextId ? 'Another idea →' : 'Another idea'}
        </button>
      )}
      {genErr && !genRun && <div className="status err" role="alert">{genErr} <button className="tb under" onClick={another}>Retry</button></div>}

      <div className="actions">
        <button className="secondary" onClick={saveIdea} aria-pressed={idea.saved} disabled={idea.saved}>{idea.saved ? 'Saved ✓' : 'Save'}</button>
        <button className="secondary" onClick={startWriting} disabled={starting}>{idea.song ? 'Continue writing' : 'Start writing'}</button>
        <Menu label="More" items={[
          { label: 'Develop in Create', onClick: () => go(`/create?idea=${idea.id}${pending.trim() ? `&note=${encodeURIComponent(pending.trim())}` : ''}`) },
          ...(!journalMode && board?.prevId ? [{ label: 'Previous idea', onClick: () => move(board.prevId!) }] : []),
          ...(!journalMode ? [{ label: 'History', onClick: () => setRecentOpen(true) }] : []),
          ...(journalMode ? [{ label: 'Open on Ideas', onClick: async () => { try { await api('POST', '/springboard/current', { ideaId: idea.id }); go('/ideas'); } catch (e) { toast((e as Error).message); } } }] : []),
        ]} />
      </div>
      <div className={`status ${status?.err ? 'err' : ''}`} role="status" aria-live="polite">
        {status?.text}{status?.retry && <button className="tb under" onClick={status.retry}>Retry</button>}
      </div>

      {/* a thought: his own words, kept with the idea */}
      <div className="thought">
        {!!idea.fragments.length && <FragmentList items={idea.fragments} onSave={saveFragment} onRemove={removeFragment} />}
        {thoughtOpen || idea.fragments.length
          ? <Composer value={pending} onChange={onPending} onSubmit={addThought} busy={adding} inputRef={composerRef}
              placeholder="A thought, a phrase, half a line… kept exactly as you type it" label="Add a thought to this idea" submitLabel="Keep" submitAria="Keep this thought with the idea" />
          : <button className="tb under" style={{ paddingLeft: 0 }} onClick={() => { setThoughtOpen(true); setTimeout(() => composerRef.current?.focus(), 50); }}>Add a thought</button>}
      </div>

      {!journalMode && board && (
        <nav className="pager" aria-label="Ideas">
          <button className="tb" disabled={!board.prevId || busy} onClick={() => board.prevId && move(board.prevId)}>← Previous</button>
          <button className="tb" onClick={() => setRecentOpen(true)}>History</button>
          {board.nextId ? <button className="tb" disabled={busy} onClick={() => move(board.nextId!)}>Next →</button> : <span className="tb" aria-hidden="true" />}
        </nav>
      )}
      {recentOpen && <Recent onClose={() => setRecentOpen(false)} onPick={(id) => { setRecentOpen(false); void move(id); }} />}
      {dirOpen && board && <DirectionSheet board={board} onClose={() => setDirOpen(false)} onSave={setDirection} />}
    </div>
  );
}

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

/** "For you", or the direction in a few words; opens the selector. */
function ForYou({ board, onOpen }: { board: Board; onOpen: () => void }) {
  const genre = board.genres?.find((g) => g.id === (board.direction.genre || 'pop'))?.label ?? 'Pop';
  const text = board.direction.text.trim().split('\n')[0];
  const ref = refSummary(board.reference);
  const label = [text ? (text.length > 28 ? text.slice(0, 26) + '…' : text) : null, ref ? `like ${ref}` : null].filter(Boolean).join(' · ');
  return (
    <button className="for-you" onClick={onOpen} aria-label="Direction for new ideas">
      <span className="eyebrow">Ideas for</span> <span className="v">{label || (board.direction.genre && board.direction.genre !== 'pop' ? genre : 'For you')}</span> <span aria-hidden="true">▾</span>
    </button>
  );
}

/** The compact selector: genre, a line of direction, a reference. Steers the next idea only. */
function DirectionSheet({ board, onClose, onSave }: { board: Board; onClose: () => void; onSave: (p: { genre?: string; text?: string; refId?: string | null }) => Promise<void> }) {
  const [genre, setGenre] = useState(board.direction.genre || 'pop');
  const [text, setText] = useState(board.direction.text);
  const [ref, setRef] = useState<Ref | null>(board.reference);
  const [busy, setBusy] = useState(false);
  return (
    <Overlay title="Ideas for" onClose={onClose}>
      <div className="genres" role="group" aria-label="Genre">
        {(board.genres ?? []).map((g) => <button key={g.id} aria-pressed={genre === g.id} onClick={() => setGenre(g.id)}>{g.label}</button>)}
      </div>
      <label className="fld">A line of direction (optional)
        <input className="line" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. sharp and conversational, female narrator" />
      </label>
      <RefChecker value={ref} onChange={setRef} />
      <div className="actions" style={{ margin: '12px 0 8px' }}>
        <button className="secondary" onClick={onClose}>Cancel</button>
        <button className="primary" disabled={busy || ref?.status === 'pending'} onClick={async () => { setBusy(true); await onSave({ genre, text, refId: ref && !ref.rejected ? ref.id : null }); setBusy(false); onClose(); }}>{busy ? 'Saving…' : 'Use for new ideas'}</button>
      </div>
      <p className="small muted">Steers the next idea; the one on screen stays as it is. For a full brief, a song in progress or ten titles at once, use <a href="#/create">Create</a>.</p>
    </Overlay>
  );
}

function Recent({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const [data, setData] = useState<{ ideas: Array<{ id: string; title: string; saved: boolean; shown_at: string; song_id: string | null }>; sessions: Array<{ id: string; title: string; updated_at: string }>; retention: string } | null>(null);
  useEffect(() => { api('GET', '/recent').then(setData).catch(() => setData({ ideas: [], sessions: [], retention: '' })); }, []);
  return (
    <Overlay title="History" onClose={onClose}>
      {!data && <Pending text="Loading…" />}
      {data?.ideas.map((i) => (
        <button key={i.id} className="list-btn" onClick={() => onPick(i.id)}>
          <span className="t">{i.title}</span>
          <small>{i.saved ? 'Saved' : 'Not saved'}{i.song_id ? ' · song started' : ''} · {new Date(i.shown_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>
        </button>
      ))}
      {data && !data.ideas.length && <p className="small muted">Nothing yet.</p>}
      {data && <p className="small muted">{data.retention}</p>}
    </Overlay>
  );
}
