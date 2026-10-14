// Create (14 Oct 2026, the simplification plan): say what you're working on, get one result
// at a time. One main input takes an idea, unfinished lyrics, a title request or a line
// problem; a reference and a collapsed Fine-tune are optional; Generate infers the task.
// Pasted lyrics are never rewritten unasked: Open in Journal makes a draft of them exactly.
// Opened with ?idea=… it develops that idea to a note (the old "What do you think?" rework,
// which also teaches the writer); with ?song=… it works for that song and can hand lines
// to its page. Under the hood a working brief is one thread; follow-ups go to the same one.

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, clientKey, draftStore, waitForRun } from './api';
import { Pending, TitleStrips, palClass } from './paper';
import { RefChecker, refSummary, type Ref } from './Direction';
import { Checks } from './bits';
import { go, useApp } from './App';
import type { Idea } from './Ideas';

type Payload = { kind?: string; reply?: string; ideas?: Array<{ title: string; concept: string; lines: string[]; checks?: any[] }>; options?: Array<{ lines: string[]; checks?: any[] }>; draft?: { sections: Array<{ label: string; lines: string[] }> } | null; note?: string; blocked?: string };
type Msg = { id: string; role: 'user' | 'assistant'; text: string; run_id: string | null; payload: Payload | null; created_at: string };
type ThreadData = { id: string; title: string; song_id: string | null; messages: Msg[]; runs: Array<{ id: string; status: string; error: { message?: string } | null; created_at: string }>; saved: Record<string, string> };
type Result =
  | { kind: 'idea'; key: string; runId: string; title: string; concept: string; lines: string[]; checks?: any[]; brief: string }
  | { kind: 'lines'; key: string; runId: string; lines: string[]; checks?: any[]; brief: string }
  | { kind: 'draft'; key: string; runId: string; sections: Array<{ label: string; lines: string[] }>; brief: string }
  | { kind: 'reply'; key: string; runId: string; text: string; brief: string };

const WANT: Array<[string, string, string]> = [
  ['auto', 'Whatever fits', ''],
  ['idea', 'An idea', 'Give me one song idea: a title, the concept in one breath, and the chorus lines it lands in.'],
  ['lines', 'Lines', 'Give me lines, not an idea package: just the words I asked for.'],
  ['titles', 'A list of titles', 'Give me ten titles, as a list, each with the two chorus lines it lands in; leave the concepts empty.'],
  ['draft', 'A full draft', 'Write a full draft with labelled sections.'],
];
const looksLikeLyrics = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean).length >= 3 && !/\?\s*$/.test(t.trim());

export function Create({ ideaId, songId }: { ideaId?: string | null; songId?: string | null }) {
  const { toast } = useApp();
  const mode: 'brief' | 'develop' = ideaId ? 'develop' : 'brief';
  const storeKey = ideaId ? `create:idea:${ideaId}` : songId ? `create:song:${songId}` : 'create:brief';
  const [brief, setBrief] = useState(() => draftStore.get(storeKey) || (ideaId ? (new URLSearchParams(location.hash.split('?')[1] ?? '').get('note') ?? '') : ''));
  useEffect(() => { draftStore.set(storeKey, brief); }, [storeKey, brief]);
  const [ref, setRef] = useState<Ref | null>(null);
  const [refOpen, setRefOpen] = useState(false);
  const [fine, setFine] = useState<{ open: boolean; rhyme: string; rhythm: string; narrator: string; want: string; keep: string }>(() => ({ open: false, rhyme: '', rhythm: '', narrator: '', want: 'auto', keep: '' }));
  const [running, setRunning] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState('');
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = ta.current; if (el) { el.style.height = 'auto'; el.style.height = `${Math.max(el.scrollHeight, 88)}px`; } }, [brief]);

  // ---- the thread behind a working brief ----
  const [threadId, setThreadId] = useState<string | null>(() => (songId || ideaId ? null : (localStorage.getItem('create.thread') || null)));
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [at, setAt] = useState<number>(-1); // which result is on screen; -1 = the latest
  async function loadThread(id = threadId) {
    if (!id) { setThread(null); return null; }
    try { const t = await api<ThreadData>('GET', `/threads/${id}`); setThread(t); return t; } catch { setThread(null); return null; }
  }
  useEffect(() => { void loadThread(); }, [threadId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const live = thread?.runs?.find((r) => r.status === 'running');
    if (live && running !== live.id) void follow(live.id);
  }, [thread]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo<Result[]>(() => {
    const out: Result[] = [];
    const msgs = thread?.messages ?? [];
    let lastBrief = '';
    for (const m of msgs) {
      if (m.role === 'user') { lastBrief = m.text; continue; }
      const p = m.payload ?? {}; const run = m.run_id ?? m.id;
      (p.ideas ?? []).forEach((i, n) => out.push({ kind: 'idea', key: `${run}:i${n}`, runId: run, title: i.title, concept: i.concept, lines: i.lines, checks: i.checks, brief: lastBrief }));
      (p.options ?? []).forEach((o, n) => out.push({ kind: 'lines', key: `${run}:o${n}`, runId: run, lines: o.lines, checks: o.checks, brief: lastBrief }));
      if (p.draft) out.push({ kind: 'draft', key: `${run}:d`, runId: run, sections: p.draft.sections, brief: lastBrief });
      if (!p.ideas?.length && !p.options?.length && !p.draft && (m.text || p.reply)) out.push({ kind: 'reply', key: `${run}:r`, runId: run, text: m.text || p.reply || '', brief: lastBrief });
    }
    return out;
  }, [thread]);
  const index = at < 0 ? results.length - 1 : Math.min(at, results.length - 1);
  const current = results[index];
  const titleList = useMemo(() => {
    // a list of titles: the latest run's ideas with no concept, shown compactly
    if (!current || current.kind !== 'idea') return null;
    const same = results.filter((r): r is Extract<Result, { kind: 'idea' }> => r.kind === 'idea' && r.runId === current.runId);
    return same.length >= 5 && same.every((r) => !r.concept.trim()) ? same : null;
  }, [results, current]);

  // ---- developing one idea (rework) ----
  const [base, setBase] = useState<Idea | null>(null);
  const [dev, setDev] = useState<Idea[]>([]); // reworked versions, newest last
  useEffect(() => {
    if (!ideaId) return;
    api<Idea>('GET', `/ideas/${ideaId}`).then((i) => { setBase(i); }).catch((e) => setErr(e.message));
  }, [ideaId]);
  const devIdea = dev.at(-1) ?? null;

  async function follow(runId: string, tid: string | null = threadId) {
    setRunning(runId); setErr('');
    try {
      const run = await waitForRun(runId);
      if (run.status !== 'succeeded') setErr(run.error?.message ?? 'That didn’t work. Your brief is still here.');
      else if (mode === 'develop' && run.result?.ideaId) { const i = await api<Idea>('GET', `/ideas/${run.result.ideaId}`); setDev((d) => [...d, i]); }
    } catch (e) { setErr((e as Error).message); }
    setRunning(null);
    if (mode === 'brief') { await loadThread(tid); setAt(-1); }
  }

  function composed(text: string) {
    const extra: string[] = [];
    const w = WANT.find((x) => x[0] === fine.want)?.[2]; if (w) extra.push(w);
    if (fine.rhyme.trim()) extra.push(`It must rhyme by sound with "${fine.rhyme.trim()}".`);
    if (fine.rhythm.trim()) extra.push(`Match the rhythm and syllable count of "${fine.rhythm.trim()}".`);
    if (fine.narrator.trim()) extra.push(`Narrator / who it's to: ${fine.narrator.trim()}.`);
    if (fine.keep.trim()) extra.push(`Keep these words exactly: ${fine.keep.trim()}.`);
    return extra.length ? `${text.trim()}\n\n${extra.join('\n')}` : text.trim();
  }
  const refText = ref && !ref.rejected ? [refSummary(ref), ref.identity, ref.want ? `what I like: ${ref.want}` : ''].filter(Boolean).join('; ') : null;

  async function generate(followUp?: string) {
    if (running) return;
    setErr(''); setStatus('');
    if (mode === 'develop') {
      const target = devIdea ?? base; if (!target) return;
      if (!brief.trim() && !followUp) { setErr('Say what should change first.'); return; }
      try {
        const r = await api<{ runId: string }>('POST', `/ideas/${target.id}/rework`, { feedback: followUp ?? brief, stay: true, clientKey: clientKey() });
        await follow(r.runId);
      } catch (e) { setErr((e as Error).message); }
      return;
    }
    const text = followUp ?? composed(brief);
    if (!text.trim()) return;
    try {
      const r = await api<{ threadId: string; runId: string }>('POST', '/messages', { threadId, songId: threadId ? null : songId ?? null, text, reference: refText, clientKey: clientKey() });
      if (!threadId) { setThreadId(r.threadId); if (!songId) localStorage.setItem('create.thread', r.threadId); }
      await follow(r.runId, r.threadId);
    } catch (e) { setErr((e as Error).message); }
  }
  function newBrief() {
    setThreadId(null); setThread(null); setAt(-1); setBrief(''); setRef(null); setErr(''); setStatus('');
    localStorage.removeItem('create.thread'); draftStore.set(storeKey, '');
  }
  async function openInJournal() {
    try { const s = await api<{ id: string }>('POST', '/songs', { title: '', text: brief }); draftStore.set(storeKey, ''); go(`/song/${s.id}`); }
    catch (e) { setErr((e as Error).message); }
  }

  // ---- result actions ----
  async function saveResult(r: Result): Promise<string | null> {
    if (r.kind === 'reply') return null;
    const body = r.kind === 'idea' ? { kind: 'seed', title: r.title, concept: r.concept, lines: r.lines }
      : r.kind === 'lines' ? { kind: 'line', title: r.lines[0]?.slice(0, 60) ?? '', concept: '', lines: r.lines }
      : { kind: 'line', title: (thread?.title ?? '').slice(0, 60), concept: '', lines: r.sections.flatMap((s) => (s.label ? [`[${s.label}]`] : []).concat(s.lines)) };
    try {
      const out = await api<{ id: string; created: boolean }>('POST', '/ideas', { sourceKey: r.key, sourceRunId: r.runId, ...body });
      setStatus(out.created ? 'Saved to your Journal.' : 'Already in your Journal.');
      await loadThread();
      return out.id;
    } catch (e) { setStatus(''); setErr((e as Error).message); return null; }
  }
  async function startWriting(r: Result) {
    if (r.kind === 'draft') {
      const text = r.sections.map((s) => `${s.label ? `[${s.label}]\n` : ''}${s.lines.join('\n')}`).join('\n\n');
      try { const s = await api<{ id: string }>('POST', '/songs', { title: thread?.title?.slice(0, 60) ?? '', text }); go(`/song/${s.id}`); } catch (e) { setErr((e as Error).message); }
      return;
    }
    const id = thread?.saved[r.key] ?? await saveResult(r);
    if (!id) return;
    try { const s = await api<{ songId: string }>('POST', `/ideas/${id}/start`); go(`/song/${s.songId}`); } catch (e) { setErr((e as Error).message); }
  }
  async function useInSong(lines: string[]) {
    if (!songId) return;
    try {
      for (const [i, l] of lines.entries()) await api('POST', '/fragments', { songId, text: l, source: 'suggestion', clientKey: `create:${current?.key}:${i}` });
      go(`/song/${songId}`);
    } catch (e) { setErr((e as Error).message); }
  }
  async function saveDev() { if (!devIdea || devIdea.saved) return; try { const i = await api<Idea>('PATCH', `/ideas/${devIdea.id}`, { saved: true }); setDev((d) => d.map((x) => (x.id === i.id ? i : x))); setStatus('Saved to your Journal.'); } catch (e) { setErr((e as Error).message); } }
  async function startDev() { if (!devIdea) return; try { const s = await api<{ songId: string }>('POST', `/ideas/${devIdea.id}/start`); go(`/song/${s.songId}`); } catch (e) { setErr((e as Error).message); } }

  const fineSummary = [fine.want !== 'auto' ? WANT.find((x) => x[0] === fine.want)?.[1] : '', fine.rhyme && `rhyme: ${fine.rhyme}`, fine.rhythm && 'keep rhythm', fine.narrator && `narrator: ${fine.narrator}`, fine.keep && `keep: ${fine.keep}`].filter(Boolean).join(' · ');
  const pal = palClass(devIdea?.palette ?? base?.palette ?? 'sage');

  return (
    <div className={`${pal} create`}>
      <div className="topline">
        <span className="eyebrow">{mode === 'develop' ? 'Developing an idea' : songId ? 'For a song' : 'Create'}</span>
        {songId && <a className="tb under" href={`#/song/${songId}`}>← Back to song</a>}
        {mode === 'develop' && <a className="tb under" href="#/ideas">← Ideas</a>}
        {mode === 'brief' && !songId && (results.length > 0 || brief) && <button className="tb under" onClick={newBrief}>New brief</button>}
      </div>

      {mode === 'develop' && base && (
        <div className="develop-base">
          <div className="small muted">{dev.length ? `Version ${dev.length + 1} of` : 'Developing'} “{base.title}”{dev.length ? '' : ' — the original stays as it is'}</div>
          {!devIdea && <>
            <TitleStrips title={base.title} parts={base.title_parts} as="h2" />
            {base.concept && <p className="concept">{base.concept}</p>}
            {!!base.lines.length && <div className="seed"><p className="seed-lines">{base.lines.map((l) => l.text).join('\n')}</p></div>}
          </>}
        </div>
      )}

      <label className="fld create-brief">
        <span className="brief-label">{mode === 'develop' ? 'What should change?' : 'What are you working on?'}</span>
        <textarea ref={ta} className="box" value={brief} onChange={(e) => setBrief(e.target.value)} rows={3}
          placeholder={mode === 'develop' ? 'e.g. keep the title, make it more grown-up and sexier' : 'Paste what you have, or tell me what you need.'} />
      </label>

      {mode === 'brief' && (
        <>
          <div className="create-opts">
            {refOpen || (ref && !ref.rejected)
              ? <div className="panel"><RefChecker value={ref} onChange={(r) => { setRef(r); if (!r) setRefOpen(false); }} /></div>
              : <button className="tb under" style={{ paddingLeft: 0 }} onClick={() => setRefOpen(true)}>Reference (optional)</button>}
            <details className="fine" open={fine.open} onToggle={(e) => setFine({ ...fine, open: (e.target as HTMLDetailsElement).open })}>
              <summary>Fine-tune{fineSummary ? <span className="small muted"> · {fineSummary}</span> : null}</summary>
              <label className="fld">What you want back
                <select className="line" value={fine.want} onChange={(e) => setFine({ ...fine, want: e.target.value })}>{WANT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </label>
              <label className="fld">Rhyme with (a word)<input className="line" value={fine.rhyme} onChange={(e) => setFine({ ...fine, rhyme: e.target.value })} placeholder="e.g. tonight" /></label>
              <label className="fld">Match the rhythm of (a line)<input className="line" value={fine.rhythm} onChange={(e) => setFine({ ...fine, rhythm: e.target.value })} placeholder="e.g. I kept coming home like that was the same as staying" /></label>
              <label className="fld">Narrator / who it's to<input className="line" value={fine.narrator} onChange={(e) => setFine({ ...fine, narrator: e.target.value })} placeholder="e.g. a woman, to the ex" /></label>
              <label className="fld">Words or lines to keep exactly<input className="line" value={fine.keep} onChange={(e) => setFine({ ...fine, keep: e.target.value })} placeholder="e.g. “good either way”" /></label>
            </details>
          </div>
          <div className="actions">
            <button className="primary" disabled={!!running || !brief.trim()} onClick={() => generate()}>{running ? 'Writing…' : 'Generate'}</button>
            {looksLikeLyrics(brief) && <button className="secondary" disabled={!!running} onClick={openInJournal}>Open in Journal</button>}
          </div>
          {looksLikeLyrics(brief) && <p className="small muted" style={{ marginTop: 6 }}>Open in Journal makes a draft of exactly what you pasted; nothing is rewritten. Generate answers what you asked about it.</p>}
        </>
      )}
      {mode === 'develop' && (
        <div className="actions">
          <button className="primary" disabled={!!running || !brief.trim() || !base} onClick={() => generate()}>{running ? 'Reworking…' : devIdea ? 'Rework again' : 'Generate'}</button>
        </div>
      )}

      <div className="status" role="status" aria-live="polite">{running ? <Pending text={mode === 'develop' ? 'Reworking the idea…' : 'Writing…'} /> : status}</div>
      {err && !running && <div className="status err" role="alert">{err} <button className="tb under" onClick={() => generate()}>Retry</button></div>}

      {/* the developed idea */}
      {mode === 'develop' && devIdea && (
        <section className="result" aria-label="Result">
          <TitleStrips title={devIdea.title} parts={devIdea.title_parts} as="h2" />
          {devIdea.concept && <p className="concept">{devIdea.concept}</p>}
          {!!devIdea.lines.length && <div className="seed"><p className="seed-lines">{devIdea.lines.map((l) => l.text).join('\n')}</p></div>}
          {devIdea.feedback && <p className="small muted">From your note: “{devIdea.feedback}”</p>}
          {(devIdea as Idea & { lesson?: { text: string; scope?: string } }).lesson && <p className="small muted lesson-note">{(devIdea as Idea & { lesson?: { scope?: string } }).lesson?.scope === 'session' ? 'Noted for today’s session' : 'Noted for every idea from now on'}: “{(devIdea as Idea & { lesson?: { text: string } }).lesson?.text}”</p>}
          <div className="prop-nav">
            <button className="tb" disabled={dev.length < 2} onClick={() => setDev((d) => d.slice(0, -1))}>← Previous version</button>
            <span className="count">version {dev.length + 1}</span>
            <button className="tb accent" disabled={!!running} onClick={() => generate(brief.trim() || 'Another take on this, different from the last.')}>Another →</button>
          </div>
          <div className="actions">
            <button className="secondary" onClick={saveDev} disabled={devIdea.saved}>{devIdea.saved ? 'Saved ✓' : 'Save'}</button>
            <button className="secondary" onClick={startDev}>{devIdea.song ? 'Continue writing' : 'Start writing'}</button>
          </div>
        </section>
      )}

      {/* one result at a time */}
      {mode === 'brief' && current && !running && (
        <section className="result" aria-label="Result">
          {titleList ? (
            <>
              <div className="eyebrow">Titles</div>
              {titleList.map((t) => (
                <div className="title-card" key={t.key}>
                  <div className="title-card-title">{t.title}</div>
                  {!!t.lines.length && <div className="title-card-lines">{t.lines.join('\n')}</div>}
                  <div className="hang-actions">
                    <button className="tb" onClick={() => saveResult(t)}>{thread?.saved[t.key] ? 'Saved ✓' : 'Save'}</button>
                    <button className="tb accent" onClick={() => startWriting(t)}>Start writing</button>
                  </div>
                </div>
              ))}
            </>
          ) : current.kind === 'idea' ? (
            <>
              <TitleStrips title={current.title} as="h2" />
              {current.concept && <p className="concept">{current.concept}</p>}
              {!!current.lines.length && <div className="seed"><p className="seed-lines">{current.lines.join('\n')}</p></div>}
              <Checks checks={current.checks?.filter((c: any) => !c.ok)} />
            </>
          ) : current.kind === 'lines' ? (
            <>
              <div className="strip">{current.lines.join('\n')}</div>
              <Checks checks={current.checks?.filter((c: any) => !c.ok)} />
            </>
          ) : current.kind === 'draft' ? (
            <div className="sheet">{current.sections.map((s, i) => <div key={i} className="section">{s.label && <div className="label">{s.label}</div>}<div className="lyrics">{s.lines.join('\n')}</div></div>)}</div>
          ) : (
            <div className="reply">{current.text}</div>
          )}
          {!titleList && (
            <div className="prop-nav">
              <button className="tb" disabled={index <= 0} onClick={() => setAt(index - 1)}>← Previous</button>
              <span className="count">{index + 1} of {results.length}</span>
              <button className="tb accent" disabled={!!running} onClick={() => (index < results.length - 1 ? setAt(index + 1) : generate('Another one, different from those so far.'))}>{index < results.length - 1 ? 'Next →' : 'Another →'}</button>
            </div>
          )}
          {!titleList && current.kind !== 'reply' && (
            <div className="actions">
              <button className="secondary" onClick={() => saveResult(current)} disabled={!!thread?.saved[current.key]}>{thread?.saved[current.key] ? 'Saved ✓' : 'Save'}</button>
              {songId && current.kind === 'lines' && <button className="primary" onClick={() => useInSong(current.lines)}>Use in song</button>}
              {!(songId && current.kind === 'lines') && <button className="secondary" onClick={() => startWriting(current)}>{current.kind === 'draft' ? 'Start a song from this' : 'Start writing'}</button>}
            </div>
          )}
          {songId && current.kind === 'lines' && <p className="small muted" style={{ marginTop: 6 }}>Use in song puts these lines on the song's page as scraps; nothing in your draft changes until you tap them in.</p>}
        </section>
      )}
      {mode === 'brief' && !current && !running && !brief && (
        <p className="empty-note" style={{ marginTop: 10 }}>Try: “a chorus title for the lyric above”, “three ideas about an ex at a wedding, country”, “a line that rhymes with ‘good either way’”, or paste a lyric and ask for the next section.</p>
      )}
    </div>
  );
}
