// Write → the idea springboard: one focused idea at a time (title scraps,
// concept, a first thread, his fragments). Also used to open a saved idea from
// the Journal in the same composition.

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, clientKey, draftStore, waitForRun } from './api';
import { TitleStrips, FragmentList, Composer, Pending, Overlay, palClass, type Fragment } from './paper';
import { DirectionBox, type Ref } from './Direction';
import { go, useApp } from './App';

export type Idea = {
  id: string; title: string; title_parts: string[] | null; concept: string; lines: Array<{ id: string; text: string }>;
  palette: string; saved: boolean; pending: string; note: string; notes: string; origin: string; kind: string;
  fragments: Fragment[]; song: { id: string; title: string } | null; shown_at: string | null;
  parent_id?: string | null; feedback?: string;
};
type Mark = 'keep' | 'change';
type Board = {
  direction: { text: string; refId: string | null; genre?: string }; reference: Ref | null; current: Idea | null;
  prevId: string | null; nextId: string | null; queued: number; number: number; runId: string | null; lastError: string | null;
  reworkRunId?: string | null; prefetching?: boolean; genres?: Array<{ id: string; label: string }>;
  writer: { connected: boolean; live: boolean };
};
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function Springboard({ ideaId }: { ideaId?: string }) {
  const journalMode = !!ideaId;
  const { toast } = useApp();
  const [board, setBoard] = useState<Board | null>(null);
  const [idea, setIdea] = useState<Idea | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [genRun, setGenRun] = useState<string | null>(null);
  const [genErr, setGenErr] = useState('');
  const [status, setStatus] = useState<{ text: string; err?: boolean; retry?: () => void } | null>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (journalMode) { setIdea(await api<Idea>('GET', `/ideas/${ideaId}`)); }
      else { const b = await api<Board>('GET', '/springboard'); setBoard(b); setIdea(b.current); if (b.runId) setGenRun(b.runId); }
      setLoadErr('');
    } catch (e) { setLoadErr((e as Error).message); }
  }, [ideaId, journalMode]);
  useEffect(() => { void load(); }, [load]);

  // Follow a generation in flight (also after a refresh). The idea on screen stays usable meanwhile.
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

  // ---- pending composer text: local copy at once, server copy shortly after ----
  const [pending, setPending] = useState('');
  const [pendingState, setPendingState] = useState<SaveState>('idle');
  const pendTimer = useRef<number>(0);
  const pendFor = useRef<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!idea) return;
    if (pendFor.current !== idea.id) {
      pendFor.current = idea.id;
      setPending(draftStore.get(`frag:${idea.id}`) || idea.pending || '');
      setPendingState('idle');
    }
  }, [idea?.id]);
  const savePending = useCallback(async (id: string, text: string) => {
    setPendingState('saving');
    try { await api('PATCH', `/ideas/${id}`, { pending: text }); setPendingState('saved'); }
    catch { setPendingState('error'); }
  }, []);
  function onPending(v: string) {
    if (!idea) return;
    setPending(v);
    draftStore.set(`frag:${idea.id}`, v);
    window.clearTimeout(pendTimer.current);
    const id = idea.id;
    pendTimer.current = window.setTimeout(() => void savePending(id, v), 800);
  }
  async function flushPending() {
    if (!idea) return;
    window.clearTimeout(pendTimer.current);
    if (pending !== idea.pending && pendingState !== 'saved') await savePending(idea.id, pending);
  }

  // ---- actions ----
  async function another() {
    setGenErr(''); setStatus(null);
    await flushPending();
    if (board?.nextId) { await move(board.nextId); return; }
    try {
      const r = await api<{ shown: boolean; runId?: string } & Partial<Board>>('POST', '/springboard/next', { clientKey: clientKey() });
      if (r.shown) { setBoard(r as Board); setIdea((r as Board).current); }
      else if (r.runId) setGenRun(r.runId);
    } catch (e) { setGenErr((e as Error).message); }
  }
  async function move(id: string) {
    await flushPending();
    try { const b = await api<Board>('POST', '/springboard/current', { ideaId: id }); setBoard(b); setIdea(b.current); setStatus(null); window.scrollTo(0, 0); }
    catch (e) { toast((e as Error).message); }
  }
  const [adding, setAdding] = useState(false);
  async function addFragment() {
    if (!idea || !pending.trim()) return;
    setAdding(true);
    const text = pending;
    try {
      const f = await api<Fragment>('POST', '/fragments', { ideaId: idea.id, text, clientKey: `${idea.id}:${hash(text)}:${idea.fragments.length}` });
      setIdea({ ...idea, fragments: [...idea.fragments, f], pending: '' });
      setPending(''); draftStore.set(`frag:${idea.id}`, '');
      void savePending(idea.id, '');
      setStatus({ text: 'Added to this idea.' });
      composerRef.current?.focus();
    } catch (e) {
      const ae = e as ApiError;
      setStatus({ text: ae.status === 0 ? 'Couldn’t reach Songroom. Your text is still here.' : ae.message, err: true, retry: addFragment });
    }
    setAdding(false);
  }
  async function saveFragment(f: Fragment) {
    if (!idea || f.saved) return;
    try {
      const out = await api<Fragment>('PATCH', `/fragments/${f.id}`, { saved: true });
      setIdea({ ...idea, fragments: idea.fragments.map((x) => (x.id === f.id ? out : x)) });
      setStatus({ text: 'Fragment saved to your journal.' });
    } catch (e) { setStatus({ text: (e as Error).message, err: true, retry: () => saveFragment(f) }); }
  }
  async function removeFragment(f: Fragment) {
    if (!idea) return;
    if (f.saved && !confirm('This fragment is in your journal. Remove it everywhere?')) return;
    try { await api('DELETE', `/fragments/${f.id}`); setIdea({ ...idea, fragments: idea.fragments.filter((x) => x.id !== f.id) }); }
    catch (e) { setStatus({ text: (e as Error).message, err: true }); }
  }
  async function saveIdea() {
    if (!idea) return;
    setStatus({ text: 'Saving…' });
    try { const out = await api<Idea>('PATCH', `/ideas/${idea.id}`, { saved: true }); setIdea(out); setStatus({ text: 'Idea saved to your journal.' }); }
    catch (e) { setStatus({ text: `Couldn’t save: ${(e as Error).message}`, err: true, retry: saveIdea }); }
  }
  const [starting, setStarting] = useState(false);
  async function startWriting() {
    if (!idea || starting) return;
    setStarting(true);
    await flushPending();
    try { const r = await api<{ songId: string }>('POST', `/ideas/${idea.id}/start`); go(`/song/${r.songId}`); }
    catch (e) { setStatus({ text: (e as Error).message, err: true, retry: startWriting }); setStarting(false); }
  }

  // ---- marks and rework: tap the title, the idea or a line to keep it (tap again: change it) ----
  const [marks, setMarks] = useState<{ title: boolean; concept: boolean; lines: Record<string, Mark> }>({ title: false, concept: false, lines: {} });
  const [note, setNote] = useState('');
  const [applyToNew, setApplyToNew] = useState(false);
  const [reworkRun, setReworkRun] = useState<string | null>(null);
  const [reworkErr, setReworkErr] = useState('');
  useEffect(() => {
    setMarks({ title: false, concept: false, lines: {} });
    setNote(idea ? draftStore.get(`note:${idea.id}`) : '');
    setReworkErr('');
  }, [idea?.id]);
  useEffect(() => { if (board?.reworkRunId) setReworkRun(board.reworkRunId); }, [board?.reworkRunId]);
  useEffect(() => {
    if (!reworkRun) return;
    let stop = false;
    (async () => {
      try {
        const run = await waitForRun(reworkRun);
        if (stop) return;
        if (run.status !== 'succeeded') setReworkErr(run.error?.message ?? 'That didn’t work. The idea is unchanged and your note is still here.');
        else if (idea) draftStore.set(`note:${idea.id}`, '');
      } catch (e) { if (!stop) setReworkErr((e as Error).message); }
      if (!stop) { setReworkRun(null); await load(); window.scrollTo(0, 0); }
    })();
    return () => { stop = true; };
  }, [reworkRun]); // eslint-disable-line react-hooks/exhaustive-deps
  function cycleLine(id: string) {
    setMarks((m) => {
      const cur = m.lines[id];
      const next = { ...m.lines };
      if (!cur) next[id] = 'keep'; else if (cur === 'keep') next[id] = 'change'; else delete next[id];
      return { ...m, lines: next };
    });
  }
  const marked = marks.title || marks.concept || Object.keys(marks.lines).length > 0;
  async function rework() {
    if (!idea || reworkRun || (!note.trim() && !marked)) return;
    setReworkErr('');
    try {
      const r = await api<{ runId: string }>('POST', `/ideas/${idea.id}/rework`, {
        feedback: note, keepTitle: marks.title, keepConcept: marks.concept,
        keepLineIds: Object.entries(marks.lines).filter(([, v]) => v === 'keep').map(([k]) => k),
        changeLineIds: Object.entries(marks.lines).filter(([, v]) => v === 'change').map(([k]) => k),
        applyToNew, clientKey: clientKey(),
      });
      setReworkRun(r.runId);
    } catch (e) { setReworkErr((e as Error).message); }
  }
  async function setGenre(genre: string) {
    if (!board) return;
    try { await api('PUT', '/springboard/direction', { genre }); await load(); toast('New ideas will follow that.'); }
    catch (e) { toast((e as Error).message); }
  }

  if (loadErr) return <div className="status err" role="alert">{loadErr} <button className="tb under" onClick={load}>Retry</button></div>;
  if (!idea && !board) return <Pending text="Opening…" />;

  const writerOk = journalMode || (board?.writer.connected ?? false);

  // ---- empty state ----
  if (!idea && board) {
    return (
      <div className="pal-ochre">
        <GenreChips board={board} onPick={setGenre} />
        <DirectionBox direction={board.direction} reference={board.reference} onSaved={load} />
        <div className="topline"><span className="eyebrow">A place to start</span></div>
        <TitleStrips title="Let’s find a song." parts={['Let’s find', 'a song.']} />
        <p className="concept">One idea at a time: a title, the feeling behind it, and a first few lines. Pick a genre or add a direction first if you like.</p>
        <button className="primary big-new" disabled={!writerOk || !!genRun} onClick={another}>{genRun ? 'Writing…' : 'Give me an idea'}</button>
        <div className="status" role="status" aria-live="polite">{genRun ? <Pending text="Writing an idea…" /> : genErr || board.lastError || ''}</div>
        <OwnLine onDone={load} />
      </div>
    );
  }
  if (!idea) return null;

  const busy = !!genRun || !!reworkRun;
  return (
    <div className={palClass(idea.palette)}>
      {!journalMode && board && <GenreChips board={board} onPick={setGenre} />}
      {!journalMode && board && <DirectionBox direction={board.direction} reference={board.reference} onSaved={load} />}
      {journalMode && <div style={{ marginBottom: 6 }}><a className="tb under" style={{ paddingLeft: 0 }} href="#/journal">← Journal</a></div>}
      <div className="topline">
        <span className="eyebrow">{journalMode ? (idea.saved ? 'Saved idea' : 'Idea') : idea.parent_id ? 'Reworked' : 'A place to start'}</span>
        {!journalMode && board?.number ? <span className="serial" aria-label={`Idea number ${board.number}`}>no. {String(board.number).padStart(2, '0')}</span> : null}
      </div>
      {editing ? <EditIdea idea={idea} onDone={(i) => { if (i) setIdea(i); setEditing(false); }} /> : <>
        <button type="button" className={`markable title-mark ${marks.title ? 'is-keep' : ''}`} aria-pressed={marks.title} onClick={() => !journalMode && setMarks((m) => ({ ...m, title: !m.title }))} disabled={journalMode}
          aria-label={`Title: ${idea.title}. ${marks.title ? 'Keeping it' : 'Tap to keep it'}`}>
          <TitleStrips title={idea.title} parts={idea.title_parts} />
          {marks.title && <span className="mark-tag">keep</span>}
        </button>
        {idea.concept && (
          <button type="button" className={`markable concept-mark ${marks.concept ? 'is-keep' : ''}`} aria-pressed={marks.concept} onClick={() => !journalMode && setMarks((m) => ({ ...m, concept: !m.concept }))} disabled={journalMode}>
            <span className="concept">{idea.concept}</span>{marks.concept && <span className="mark-tag">keep</span>}
          </button>
        )}
        {idea.feedback && <p className="writer-note">Reworked from your note: “{idea.feedback}”{idea.parent_id && board?.prevId === idea.parent_id && <> · <button className="tb under inline" onClick={() => move(idea.parent_id!)}>see the one before</button></>}</p>}
        {idea.note && <p className="writer-note">{idea.note}</p>}
        {!!idea.lines.length && (
          <div className="seed">
            <div className="eyebrow">A first few lines</div>
            <div className="seed-lines markable-lines">
              {idea.lines.map((l) => {
                const m = marks.lines[l.id];
                return (
                  <button type="button" key={l.id} disabled={journalMode} className={`line-mark ${m ? `is-${m}` : ''}`} onClick={() => cycleLine(l.id)}
                    aria-label={`${l.text}. ${m === 'keep' ? 'Keeping it; tap to mark it for changing' : m === 'change' ? 'Marked to change; tap to clear' : 'Tap to keep this line'}`}>
                    <span className="t">{l.text}</span>{m && <span className="mark-tag">{m}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </>}

      {!journalMode && board && (
        <div className="react">
          <div className="hand">What do you think?</div>
          <p className="small muted react-hint">Tap the title, the idea or a line to keep it; tap a line twice to change it. Then say what you’d like.</p>
          <Composer value={note} onChange={(v) => { setNote(v); draftStore.set(`note:${idea.id}`, v); }} onSubmit={rework} busy={busy}
            placeholder="e.g. love the title, make it more grown-up and sexy" label="What you think of this idea" submitLabel={reworkRun ? 'Reworking…' : 'Rework'} submitAria="Rework this idea" />
          {marked && !note.trim() && <button className="tb under" style={{ paddingLeft: 0 }} disabled={busy} onClick={rework}>Rework, keeping what I tapped</button>}
          <label className="check"><input type="checkbox" checked={applyToNew} onChange={(e) => setApplyToNew(e.target.checked)} /> Use this note for new ideas too</label>
          {reworkRun && <div style={{ marginTop: 8 }}><Pending text="Reworking this idea…" /></div>}
          {reworkErr && <div className="status err" role="alert">{reworkErr}</div>}
        </div>
      )}

      {!journalMode && board && (
        <button className="primary big-new" disabled={(!writerOk && !board.nextId) || busy} onClick={another}>
          {genRun ? 'Writing a new idea…' : board.nextId ? 'Next idea →' : 'New idea'}
        </button>
      )}
      {genErr && !genRun && <div className="status err" role="alert">{genErr}</div>}

      <div className="actions">
        <button className="secondary" onClick={saveIdea} aria-pressed={idea.saved}>{idea.saved ? 'Idea saved ✓' : 'Save idea'}</button>
        <button className="secondary" onClick={startWriting} disabled={starting || busy}>{idea.song ? 'Open its page ↗' : 'Make it a page ↗'}</button>
      </div>
      <div className={`status ${status?.err || pendingState === 'error' ? 'err' : ''}`} role="status" aria-live="polite">
        {status?.text}{status?.retry && <button className="tb under" onClick={status.retry}>Retry</button>}
        {!status && pendingState === 'error' && <>Couldn’t save your draft line; it’s kept on this device. <button className="tb under" onClick={() => savePending(idea.id, pending)}>Retry</button></>}
        {!status && pendingState === 'saving' && 'Saving…'}
      </div>

      <div className="hand" style={{ marginTop: 22 }}>Your own scraps</div>
      <FragmentList items={idea.fragments} onSave={saveFragment} onRemove={removeFragment} />
      <Composer value={pending} onChange={onPending} onSubmit={addFragment} busy={adding} inputRef={composerRef}
        placeholder="A phrase, a memory, half a line…" label="Add a fragment to this idea" />

      {journalMode && <div className="row" style={{ marginTop: 8 }}><button className="tb under" style={{ paddingLeft: 0 }} onClick={() => setEditing(true)}>Edit words</button></div>}
      {!journalMode && board && (
        <nav className="pager" aria-label="Ideas">
          <button className="tb" disabled={!board.prevId || busy} onClick={() => board.prevId && move(board.prevId)}>← Previous</button>
          <button className="tb" onClick={() => setRecentOpen(true)}>Recent</button>
          {board.nextId ? <button className="tb" disabled={busy} onClick={() => move(board.nextId!)}>Next →</button> : <span className="tb" aria-hidden="true" />}
        </nav>
      )}
      {recentOpen && <Recent onClose={() => setRecentOpen(false)} onPick={(id) => { setRecentOpen(false); void move(id); }} onNew={() => { setRecentOpen(false); void freshIdea(); }} />}
    </div>
  );

  async function freshIdea() {
    await flushPending();
    try {
      const r = await api<{ shown: boolean; runId?: string } & Partial<Board>>('POST', '/springboard/next', { clientKey: clientKey() });
      if (r.shown) { setBoard(r as Board); setIdea((r as Board).current); } else if (r.runId) setGenRun(r.runId);
    } catch (e) { setGenErr((e as Error).message); }
  }
}

function GenreChips({ board, onPick }: { board: Board; onPick: (g: string) => void }) {
  const genres = board.genres ?? [];
  if (!genres.length) return null;
  const cur = board.direction.genre || 'pop';
  return (
    <div className="genres" role="group" aria-label="Ideas for">
      <span className="eyebrow">Ideas for</span>
      {genres.map((g) => <button key={g.id} aria-pressed={cur === g.id} onClick={() => cur !== g.id && onPick(g.id)}>{g.label}</button>)}
    </div>
  );
}

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

function OwnLine({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState(() => draftStore.get('own-line'));
  const [err, setErr] = useState('');
  return (
    <div style={{ marginTop: 26 }}>
      <div className="hand">Or start from your own line</div>
      <Composer value={text} onChange={(v) => { setText(v); draftStore.set('own-line', v); }} label="Start from your own line"
        placeholder="A title, a hook, half a line…" submitLabel="Start" submitAria="Start an idea from this line"
        onSubmit={async () => {
          try { await api('POST', '/springboard/own', { text, clientKey: clientKey() }); draftStore.set('own-line', ''); setText(''); onDone(); }
          catch (e) { setErr((e as Error).message); }
        }} />
      {err && <div className="status err" role="alert">{err}</div>}
    </div>
  );
}

function Recent({ onClose, onPick, onNew }: { onClose: () => void; onPick: (id: string) => void; onNew: () => void }) {
  const [data, setData] = useState<{ ideas: Array<{ id: string; title: string; saved: boolean; shown_at: string; song_id: string | null }>; sessions: Array<{ id: string; title: string; updated_at: string }>; retention: string } | null>(null);
  useEffect(() => { api('GET', '/recent').then(setData).catch(() => setData({ ideas: [], sessions: [], retention: '' })); }, []);
  return (
    <Overlay title="Recent" onClose={onClose}>
      <button className="list-btn" onClick={onNew}><span className="t">A new idea ↗</span><small>Uses your current direction</small></button>
      {!data && <Pending text="Loading…" />}
      {data?.ideas.map((i) => (
        <button key={i.id} className="list-btn" onClick={() => onPick(i.id)}>
          <span className="t">{i.title}</span>
          <small>{i.saved ? 'Saved' : 'Not saved'}{i.song_id ? ' · song started' : ''} · {new Date(i.shown_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>
        </button>
      ))}
      {!!data?.sessions.length && <>
        <div className="eyebrow" style={{ marginTop: 18 }}>Earlier sessions</div>
        {data.sessions.map((s) => <a key={s.id} className="list-btn" href={`#/session/${s.id}`} onClick={onClose}><span className="t" style={{ fontSize: 16, fontFamily: 'var(--sans)' }}>{s.title || 'Untitled session'}</span><small>{new Date(s.updated_at).toLocaleDateString()}</small></a>)}
      </>}
      {data && <p className="small muted">{data.retention}</p>}
    </Overlay>
  );
}

function EditIdea({ idea, onDone }: { idea: Idea; onDone: (i: Idea | null) => void }) {
  const [title, setTitle] = useState(idea.title);
  const [concept, setConcept] = useState(idea.concept);
  const [lines, setLines] = useState(idea.lines.map((l) => l.text).join('\n'));
  const [err, setErr] = useState('');
  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <label className="fld">Title<input className="line" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="fld">Concept<textarea className="box" rows={2} value={concept} onChange={(e) => setConcept(e.target.value)} /></label>
      <label className="fld">First thread<textarea className="box" rows={4} value={lines} onChange={(e) => setLines(e.target.value)} /></label>
      {err && <div className="status err">{err}</div>}
      <div className="actions" style={{ margin: '8px 0' }}>
        <button className="secondary" onClick={() => onDone(null)}>Cancel</button>
        <button className="primary" onClick={async () => {
          try { onDone(await api<Idea>('PATCH', `/ideas/${idea.id}`, { title, concept, lines: lines.split('\n').filter((l) => l.trim()) })); } catch (e) { setErr((e as Error).message); }
        }}>Save words</button>
      </div>
    </div>
  );
}
