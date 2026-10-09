import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, clientKey, copy, draftStore, waitForRun, type Section } from './api';
import { Icon, Motif, Thinking, timeAgo } from './bits';
import { go, useApp } from './App';
import { ThreadView } from './Thread';
import { EditOptions, type EditPayload } from './edits';

type Song = {
  id: string; title: string; brief: string; notes: string; starred: boolean; motif: number; current_rev: number; locks: string[];
  sections: Section[]; threadId: string; idea: { id: string; title: string } | null;
  suno: { title: string; style: string; exclude: string; lyrics: string; rev: number; hint: string; warnings: string[]; createdAt: string } | null;
};
type Sel = { kind: 'line' } | { kind: 'span'; a: number; b: number };

const TABS = ['Lyrics', 'Talk', 'Suno', 'History'] as const;

function render(sections: Section[]) {
  return sections.map((s) => (s.label ? `[${s.label}]\n` : '') + s.lines.map((l) => l.text).join('\n')).join('\n\n');
}

function words(text: string) {
  const out: Array<{ start: number; end: number; w: string }> = [];
  for (const m of text.matchAll(/\S+/g)) {
    let start = m.index!, end = start + m[0].length;
    while (start < end && /["“‘'(]/.test(text[start])) start++;
    while (end > start && /[.,;:!?"”’')…]/.test(text[end - 1])) end--;
    if (end > start) out.push({ start, end, w: text.slice(start, end) });
  }
  return out;
}

export function SongPage({ id }: { id: string }) {
  const { toast } = useApp();
  const [song, setSong] = useState<Song | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<(typeof TABS)[number]>('Lyrics');

  const load = useCallback(async () => {
    try { setSong(await api<Song>('GET', `/songs/${id}`)); setErr(''); } catch (e) { setErr((e as Error).message); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (err) return <div className="error">{err}</div>;
  if (!song) return null;

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <a className="linkbtn" href="#/journal">Journal</a>
        {song.idea && <a className="small muted" href={`#/idea/${song.idea.id}`}>From the seed “{song.idea.title}”</a>}
      </div>
      <SongHead song={song} onChange={setSong} />
      <div className="tabs" role="tablist">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {tab === 'Lyrics' && <Lyrics song={song} reload={load} toast={toast} />}
      {tab === 'Talk' && (
        <ThreadView threadId={song.threadId} songId={song.id} songRev={song.current_rev} onSongChanged={load}
          placeholder="Talk about this song, or ask for lines or a draft"
          emptyState={<p className="muted">Ask for lines, a second verse, a full draft, or what's not working. The writer sees the current lyric and your song notes.</p>} />
      )}
      {tab === 'Suno' && <Suno song={song} reload={load} toast={toast} />}
      {tab === 'History' && <History song={song} reload={load} toast={toast} />}
    </div>
  );
}

function SongHead({ song, onChange }: { song: Song; onChange: (s: Song) => void }) {
  const [title, setTitle] = useState(song.title);
  const [brief, setBrief] = useState(song.brief);
  const [notes, setNotes] = useState(song.notes);
  const t = useRef<number>(0);
  const save = (patch: Record<string, unknown>) => {
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => { api<Song>('PATCH', `/songs/${song.id}`, patch).then(onChange).catch(() => {}); }, 600);
  };
  return (
    <div className="songhead">
      <input className="titlein" aria-label="Song title" placeholder="Untitled" value={title} onChange={(e) => { setTitle(e.target.value); save({ title: e.target.value }); }} />
      <details>
        <summary className="small muted" style={{ cursor: 'pointer' }}>Song notes{brief ? '' : ' (narrator, situation, what it’s really about)'}</summary>
        <div className="stack" style={{ marginTop: 8 }}>
          <label className="field">What the writer should know: who’s singing, to whom, the situation, facts that are settled
            <textarea rows={4} value={brief} onChange={(e) => { setBrief(e.target.value); save({ brief: e.target.value }); }} />
          </label>
          <label className="field">Private notes (not sent to the writer)
            <textarea rows={3} value={notes} onChange={(e) => { setNotes(e.target.value); save({ notes: e.target.value }); }} />
          </label>
        </div>
      </details>
    </div>
  );
}

function Lyrics({ song, reload, toast }: { song: Song; reload: () => Promise<void>; toast: (s: string) => void }) {
  const [mode, setMode] = useState<'read' | 'select' | 'text'>('read');
  const [sel, setSel] = useState<Record<string, Sel>>({});
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ p: EditPayload; runId: string | null } | null>(null);
  const [err, setErr] = useState('');
  const locks = new Set(song.locks);
  const draftKey = `songtext:${song.id}:${song.current_rev}`;
  const [text, setText] = useState('');

  const allLines = song.sections.flatMap((s) => s.lines);
  const selIds = Object.keys(sel);
  const single = selIds.length === 1 ? allLines.find((l) => l.id === selIds[0]) : undefined;

  function toggleLine(lineId: string) {
    if (locks.has(lineId)) { toast('That line is locked. Unlock it to change it.'); return; }
    setSel((s) => { const n = { ...s }; if (n[lineId]) delete n[lineId]; else n[lineId] = { kind: 'line' }; return n; });
    setResult(null);
  }

  function tapWord(lineId: string, idx: number) {
    setSel((s) => {
      const cur = s[lineId];
      if (!cur || cur.kind === 'line') return { ...s, [lineId]: { kind: 'span', a: idx, b: idx } };
      if (cur.a === cur.b && cur.a === idx) return { ...s, [lineId]: { kind: 'line' } };
      return { ...s, [lineId]: { kind: 'span', a: Math.min(cur.a, idx), b: Math.max(cur.a, idx) } };
    });
    setResult(null);
  }

  async function toggleLock(lineId: string) {
    const next = locks.has(lineId) ? song.locks.filter((x) => x !== lineId) : [...song.locks, lineId];
    await api('PATCH', `/songs/${song.id}`, { locks: next }).catch((e) => toast(e.message));
    setSel((s) => { const n = { ...s }; delete n[lineId]; return n; });
    await reload();
  }

  function targets() {
    return allLines.filter((l) => sel[l.id]).map((l) => {
      const s = sel[l.id];
      if (s.kind === 'line') return { kind: 'line', lineId: l.id, expected: l.text };
      const w = words(l.text);
      const start = w[s.a].start, end = w[s.b].end;
      return { kind: 'span', lineId: l.id, start, end, expected: l.text.slice(start, end) };
    });
  }

  async function ask() {
    if (!instruction.trim()) return;
    setErr(''); setResult(null); setBusy('asking');
    try {
      const r = await api('POST', `/songs/${song.id}/edit`, { baseRev: song.current_rev, targets: targets(), instruction, clientKey: clientKey() });
      if (r.direct) setResult({ p: r, runId: null });
      else {
        setBusy(r.runId);
        const run = await waitForRun(r.runId);
        if (run.status === 'succeeded') setResult({ p: run.result, runId: r.runId });
        else setErr(run.error?.message ?? 'The writer failed. Your song is unchanged.');
      }
    } catch (e) {
      const ae = e as ApiError;
      setErr(ae.message);
      if (ae.status === 409) await reload();
    }
    setBusy(null);
  }

  async function saveText() {
    setBusy('saving'); setErr('');
    try {
      await api('PUT', `/songs/${song.id}/text`, { baseRev: song.current_rev, text });
      draftStore.set(draftKey, '');
      setMode('read');
      await reload();
    } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  }

  const done = async () => { setSel({}); setInstruction(''); setResult(null); setMode('read'); await reload(); };

  if (mode === 'text') {
    return (
      <div className="stack">
        <textarea className="code" style={{ minHeight: '55dvh', border: 0 }} value={text} aria-label="Lyrics"
          onChange={(e) => { setText(e.target.value); draftStore.set(draftKey, e.target.value); }} />
        <div className="small muted">[Verse], [Chorus] and so on on their own line start a section.{song.locks.length ? ' Locked lines must stay as they are.' : ''}</div>
        {err && <div className="error" role="alert">{err}</div>}
        <div className="row">
          <button className="btn" disabled={busy === 'saving'} onClick={saveText}>Save</button>
          <button className="btn quiet" onClick={() => { draftStore.set(draftKey, ''); setMode('read'); setErr(''); }}>Cancel</button>
        </div>
      </div>
    );
  }

  const selecting = mode === 'select';
  return (
    <div>
      <article className={`sheet ${selecting ? 'selecting' : ''}`}>
        <Motif n={song.motif} />
        {!allLines.length && <div className="lyric muted">No lyrics yet. Use Edit text to paste some, or ask for a draft in Talk.</div>}
        {song.sections.map((s) => (
          <div key={s.id} className="section">
            {s.label && <div className="label">{s.label}</div>}
            {s.lines.map((l) => {
              const sl = sel[l.id];
              const locked = locks.has(l.id);
              return (
                <div key={l.id}>
                  <div className={`lyricline ${sl ? 'sel' : ''} ${locked ? 'locked' : ''}`}>
                    {selecting
                      ? <button className="t linebtn" aria-pressed={!!sl} onClick={() => toggleLine(l.id)}>{l.text}</button>
                      : <span className="t">{l.text}</span>}
                    {(selecting || locked) && (
                      <button className={`lockbtn ${locked ? 'on' : ''}`} aria-label={locked ? `Unlock “${l.text}”` : `Lock “${l.text}”`}
                        onClick={() => void toggleLock(l.id)}>{locked ? Icon.lock : Icon.unlock}</button>
                    )}
                  </div>
                  {selecting && sl && single?.id === l.id && (
                    <div className="words" aria-label="Pick words">
                      {words(l.text).map((w, i) => {
                        const inRange = sl.kind === 'span' && i >= sl.a && i <= sl.b;
                        return <button key={i} className={inRange ? 'in' : ''} onClick={() => tapWord(l.id, i)}>{w.w}</button>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </article>

      {!selecting && (
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => { setMode('select'); setSel({}); setResult(null); setErr(''); }} disabled={!allLines.length}>Change words</button>
          <button className="btn quiet" onClick={() => { const d = draftStore.get(draftKey); setText(d || render(song.sections)); setMode('text'); setErr(''); }}>Edit text</button>
          <button className="btn quiet" onClick={() => void copy(render(song.sections)).then((ok) => toast(ok ? 'Copied' : 'Copy failed'))}>Copy</button>
        </div>
      )}

      {selecting && (
        <div className="editsheet">
          <div className="small muted">
            {!selIds.length ? 'Tap the lines to change. With one line selected, tap words to narrow it down. Locked lines can’t change.'
              : single ? (sel[single.id].kind === 'span' ? 'Only the dark words can change.' : 'The whole line can change. Tap words to narrow it.')
              : `${selIds.length} lines can change. Nothing else will.`}
            {!selIds.length && ' Or leave nothing selected for a direct change like “change Quit to You stopped”.'}
          </div>
          <textarea rows={2} placeholder="What should change? e.g. three options, keep the rhythm, end on ‘losing you’" aria-label="What should change"
            value={instruction} onChange={(e) => setInstruction(e.target.value)} />
          <div className="row">
            <button className="btn" disabled={!instruction.trim() || !!busy} onClick={ask}>Suggest</button>
            <button className="btn quiet" onClick={() => { setMode('read'); setSel({}); setResult(null); setErr(''); }}>Done</button>
          </div>
          {busy && busy !== 'saving' && <Thinking onCancel={busy.startsWith('r_') ? () => void api('POST', `/runs/${busy}/cancel`) : undefined} />}
          {err && <div className="error" role="alert">{err}</div>}
          {result && <EditOptions songId={song.id} p={result.p} runId={result.runId} toast={toast} onApplied={done} />}
        </div>
      )}
    </div>
  );
}

function Suno({ song, reload, toast }: { song: Song; reload: () => Promise<void>; toast: (s: string) => void }) {
  const [hint, setHint] = useState(song.suno?.hint ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const s = song.suno;

  async function build() {
    setErr(''); setBusy('starting');
    try {
      const r = await api('POST', `/songs/${song.id}/suno`, { hint, clientKey: clientKey() });
      setBusy(r.runId);
      const run = await waitForRun(r.runId);
      if (run.status !== 'succeeded') setErr(run.error?.message ?? 'That failed.');
      await reload();
    } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  }
  const cp = (t: string) => void copy(t).then((ok) => toast(ok ? 'Copied' : 'Copy failed'));

  return (
    <div className="stack">
      <label className="field">Production direction (optional)
        <textarea rows={2} placeholder="e.g. stripped back until the last chorus, 90s country radio, female vocal" value={hint} onChange={(e) => setHint(e.target.value)} />
      </label>
      <div className="row">
        <button className="btn" disabled={!!busy} onClick={build}>{s ? 'Rebuild Suno prompt' : 'Build Suno prompt'}</button>
      </div>
      {busy && <Thinking text="Building" />}
      {err && <div className="error" role="alert">{err}</div>}
      {s && (
        <>
          {s.rev !== song.current_rev && <div className="banner">The lyric has changed since this was built (version {s.rev}). Rebuild to match the current words.</div>}
          {s.warnings?.map((w, i) => <div key={i} className="error small">{w}</div>)}
          <div className="blockhead"><h3>Style</h3><button className="btn quiet sm" onClick={() => cp(s.style)}>Copy</button></div>
          <div className="code">{s.style}</div>
          <div className="small muted">{s.style.length} characters</div>
          {s.exclude && (<>
            <div className="blockhead"><h3>Exclude styles</h3><button className="btn quiet sm" onClick={() => cp(s.exclude)}>Copy</button></div>
            <div className="code">{s.exclude}</div>
          </>)}
          <div className="blockhead"><h3>Lyrics</h3><button className="btn quiet sm" onClick={() => cp(s.lyrics)}>Copy</button></div>
          <div className="code">{s.lyrics}</div>
          <div className="small muted">Your words exactly as written; only the bracketed tags were added. Built {timeAgo(s.createdAt)}. In Suno, use Custom mode and paste each part into its box.</div>
        </>
      )}
    </div>
  );
}

function History({ song, reload, toast }: { song: Song; reload: () => Promise<void>; toast: (s: string) => void }) {
  const [revs, setRevs] = useState<Array<{ rev: number; source: string; note: string; created_at: string; sections: Section[] }>>([]);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => { api('GET', `/songs/${song.id}/revisions`).then(setRevs).catch(() => {}); }, [song.id, song.current_rev]);
  const what = (s: string) => ({ created: 'Started', typed: 'Edited by hand', 'edit:direct': 'Direct change', 'edit:writer': 'Used a suggestion', draft: 'Used a draft', restore: 'Restored' } as Record<string, string>)[s] ?? s;
  return (
    <div className="revs">
      {revs.map((r) => (
        <div key={r.rev}>
          <button onClick={() => setOpen(open === r.rev ? null : r.rev)} aria-expanded={open === r.rev}>
            <span>Version {r.rev}{r.rev === song.current_rev ? ' (current)' : ''}: {what(r.source)}{r.note ? `, ${r.note.slice(0, 60)}` : ''}</span>
            <span className="small muted">{timeAgo(r.created_at)}</span>
          </button>
          {open === r.rev && (
            <div className="stack" style={{ padding: '10px 0 16px' }}>
              <div className="code">{render(r.sections)}</div>
              {r.rev !== song.current_rev && (
                <div><button className="btn quiet sm" onClick={async () => {
                  try { await api('POST', `/songs/${song.id}/restore`, { rev: r.rev, baseRev: song.current_rev }); toast(`Restored version ${r.rev} as a new version`); await reload(); } catch (e) { toast((e as Error).message); }
                }}>Restore this version</button></div>
              )}
            </div>
          )}
        </div>
      ))}
      <div className="row" style={{ marginTop: 24 }}>
        <button className="btn danger sm" onClick={async () => { if (confirm('Delete this song and all its versions? This can’t be undone. (Export a backup first from Settings if unsure.)')) { await api('DELETE', `/songs/${song.id}`); go('/journal'); } }}>Delete song</button>
      </div>
    </div>
  );
}
