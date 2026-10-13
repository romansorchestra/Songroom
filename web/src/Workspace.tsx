// The song workspace (approved design): an unrotated, autosaved lyric sheet;
// select words or lines and ask; one suggestion at a time with Previous /
// Another / Keep. Browsing never touches the lyric; only Keep does, and the
// server enforces the selected span. Starting points stay separate until added.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, clientKey, copy, draftStore, waitForRun, type Section } from './api';
import { TitleStrips, FragmentList, Composer, Pending, Overlay, palClass, type Fragment } from './paper';
import { RefChecker, refSummary, type Ref } from './Direction';
import { lyricLinesOf } from '../../shared/lyricShape';
import { go, useApp } from './App';

type Target = { kind: 'line'; lineId: string; expected: string } | { kind: 'span'; lineId: string; start: number; end: number; expected: string };
type Item = { replacements?: Array<{ lineId: string; newText: string }>; diff?: Array<{ lineId: string; before: string; after: string }>; lines?: string[]; checks: Array<{ label: string; ok: boolean }>; direct?: boolean };
type SetRow = {
  id: string; run_id: string | null; base_rev: number; mode: 'replace' | 'add'; targets: { targets: Target[]; afterLineId: string | null };
  instruction: string; items: Item[] | null; status: string; error: { code: string; message: string } | null; parent_id: string | null; created_at: string;
};
type TitleSet = { id: string; run_id: string | null; ask: string; items: Array<{ title: string; lines: string[]; why: string }> | null; status: string; error: { code: string; message: string } | null; created_at: string };
type Ctx = {
  meaning: string; meaningSource: string | null; narrator: string;
  rhyme: { word: string; mode: 'fixed' | 'linked'; lineId?: string; line?: string | null; notice?: { from: string; to: string } | null } | null;
  rhythm: { sample: string; syllables: number } | null; refs: Ref[]; lastInstruction: string;
};
type WS = {
  id: string; title: string; brief: string; notes: string; current_rev: number; locks: string[]; sections: Section[]; palette: string;
  context: Ctx; idea: { id: string; title: string; concept: string; lines: Array<{ id: string; text: string }>; title_parts: string[] | null } | null;
  scraps: Fragment[]; sets: SetRow[]; titles: TitleSet[]; seedAdded?: boolean; suno: { style: string; exclude: string; lyrics: string; rev: number; warnings: string[]; createdAt: string; hint: string } | null;
};

export const render = (sections: Section[]) => sections.map((s) => (s.label ? `[${s.label}]\n` : '') + s.lines.map((l) => l.text).join('\n')).join('\n\n');
const allLines = (sections: Section[]) => sections.flatMap((s) => s.lines);

/** Map a textarea selection onto saved line IDs. Valid only when the text's lyric lines match the saved ones. */
export function mapSelection(text: string, start: number, end: number, sections: Section[]) {
  const local = lyricLinesOf(text);
  const saved = allLines(sections);
  if (local.length !== saved.length || local.some((l, i) => l.text !== saved[i].text)) return { stale: true as const };
  if (start > end) [start, end] = [end, start];
  if (start === end) {
    let after: { id: string; text: string } | null = null;
    for (let i = 0; i < local.length; i++) if (local[i].start <= start) after = saved[i];
    return { stale: false as const, targets: [] as Target[], afterLineId: after?.id ?? null, afterText: after?.text ?? null };
  }
  // trim whitespace at the edges
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  const touched = local.map((l, i) => ({ l, s: saved[i] })).filter(({ l }) => l.end > start && l.start < end);
  if (!touched.length) return { stale: false as const, targets: [] as Target[], afterLineId: null, afterText: null };
  if (touched.length === 1) {
    const { l, s } = touched[0];
    const a = Math.max(start, l.start) - l.start, b = Math.min(end, l.end) - l.start;
    if (a > 0 || b < l.text.length) return { stale: false as const, targets: [{ kind: 'span', lineId: s.id, start: a, end: b, expected: l.text.slice(a, b) }] as Target[], afterLineId: null, afterText: null };
  }
  return { stale: false as const, targets: touched.map(({ s }) => ({ kind: 'line', lineId: s.id, expected: s.text })) as Target[], afterLineId: null, afterText: null };
}

/** Word-level emphasis of what changed. */
function changedWords(before: string, after: string) {
  const a = before.split(/(\s+)/), b = after.split(/(\s+)/);
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Array<{ t: string; changed: boolean }> = [];
  let i = 0, j = 0;
  while (j < m) {
    if (i < n && a[i] === b[j]) { out.push({ t: b[j], changed: false }); i++; j++; }
    else if (i < n && dp[i + 1][j] >= dp[i][j + 1]) i++;
    else { out.push({ t: b[j], changed: !/^\s+$/.test(b[j]) }); j++; }
  }
  return out;
}

export function Workspace({ id }: { id: string }) {
  const { toast } = useApp();
  const [ws, setWs] = useState<WS | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [text, setText] = useState('');
  const [saved, setSaved] = useState<{ rev: number; sections: Section[] } | null>(null);
  const [saveState, setSaveState] = useState<{ s: 'idle' | 'saving' | 'saved' | 'error'; msg?: string }>({ s: 'idle' });
  const dirtyRef = useRef(false);
  const textRef = useRef('');
  const saving = useRef<Promise<boolean> | null>(null);
  const timer = useRef<number>(0);
  const editor = useRef<HTMLTextAreaElement>(null);
  const sel = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const askRef = useRef<HTMLTextAreaElement | null>(null);
  const touched = useRef(false); // has he put the cursor in the lyric yet? If not, new lines go at the end.
  const [selInfo, setSelInfo] = useState<ReturnType<typeof mapSelection> | null>(null);
  const [instruction, setInstruction] = useState('');
  // grow to fit whatever is in it: typed, restored after a reload, or cleared
  useLayoutEffect(() => { const el = askRef.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } });
  const [chain, setChain] = useState<SetRow[]>([]);
  const [pos, setPos] = useState<{ set: number; item: number }>({ set: 0, item: 0 });
  const [asking, setAsking] = useState(false);
  const [askErr, setAskErr] = useState('');
  const [status, setStatus] = useState<{ text: string; undo?: { rev: number; base: number }; err?: boolean } | null>(null);
  const [panel, setPanel] = useState<null | 'history' | 'suno' | 'notes' | 'context' | 'menu'>(null);

  const refresh = useCallback(async (replaceText: boolean) => {
    const w = await api<WS>('GET', `/songs/${id}`);
    setWs(w);
    setSaved({ rev: w.current_rev, sections: w.sections });
    if (replaceText) {
      const t = render(w.sections);
      textRef.current = t; setText(t); dirtyRef.current = false; draftStore.set(`song:${id}`, '');
      // The text changed under the cursor: forget the old selection rather than point at the wrong words.
      touched.current = false; sel.current = { start: t.length, end: t.length }; setSelInfo(null);
    }
    return w;
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const w = await refresh(true);
        setInstruction(w.context.lastInstruction ?? '');
        const local = draftStore.get(`song:${id}`);
        if (local && local !== render(w.sections)) { textRef.current = local; setText(local); dirtyRef.current = true; setSaveState({ s: 'error', msg: 'Unsaved changes from earlier were restored on this device.' }); scheduleSave(200); }
      } catch (e) { setLoadErr((e as Error).message); }
    })();
    return () => window.clearTimeout(timer.current);
  }, [id]);

  // ---------------- autosave ----------------
  async function save(): Promise<boolean> {
    if (saving.current) { await saving.current; if (!dirtyRef.current) return true; }
    if (!dirtyRef.current || !saved) return true;
    const sent = textRef.current;
    const p = (async () => {
      setSaveState({ s: 'saving' });
      try {
        await api('PUT', `/songs/${id}/text`, { baseRev: saved.rev, text: sent });
        const w = await api<WS>('GET', `/songs/${id}`);
        setWs(w); setSaved({ rev: w.current_rev, sections: w.sections });
        // Never replace what he's typing; just record that this text is saved.
        if (textRef.current === sent) { dirtyRef.current = false; draftStore.set(`song:${id}`, ''); }
        setSaveState({ s: 'saved' });
        return true;
      } catch (e) {
        const ae = e as ApiError;
        setSaveState({ s: 'error', msg: ae.status === 0 ? 'Offline. Your text is kept on this device.' : ae.code === 'conflict' ? 'This song changed somewhere else. Your text is kept here.' : ae.message });
        return false;
      } finally { saving.current = null; }
    })();
    saving.current = p;
    return p;
  }
  function scheduleSave(ms = 1200) { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => void save(), ms); }
  function onEdit(v: string) {
    textRef.current = v; setText(v); dirtyRef.current = true; draftStore.set(`song:${id}`, v);
    setSaveState({ s: 'idle' }); scheduleSave();
  }
  async function flush() { window.clearTimeout(timer.current); return save(); }

  // ---------------- selection ----------------
  function trackSelection() {
    const el = editor.current; if (!el || !saved) return;
    touched.current = true;
    sel.current = { start: el.selectionStart, end: el.selectionEnd };
    setSelInfo(mapSelection(el.value, el.selectionStart, el.selectionEnd, saved.sections));
  }
  useEffect(() => { if (saved && editor.current && touched.current) setSelInfo(mapSelection(editor.current.value, sel.current.start, sel.current.end, saved.sections)); }, [saved]);

  const lineById = (lid: string) => saved ? allLines(saved.sections).find((l) => l.id === lid) : undefined;
  const targetLabel = useMemo(() => {
    if (!selInfo || selInfo.stale) return null;
    if (!selInfo.targets.length) return { kind: 'add' as const, text: selInfo.afterText ? `New lines after “${selInfo.afterText}”` : 'New lines at the end' };
    if (selInfo.targets.length === 1 && selInfo.targets[0].kind === 'span') {
      const t = selInfo.targets[0]; const l = lineById(t.lineId);
      return { kind: 'span' as const, before: l?.text.slice(0, t.start) ?? '', mark: t.expected, after: l?.text.slice(t.end) ?? '' };
    }
    return { kind: 'lines' as const, text: selInfo.targets.length === 1 ? `“${selInfo.targets[0].expected}”` : `${selInfo.targets.length} lines` };
  }, [selInfo, saved]);

  // ---------------- suggestions ----------------
  const flat = useMemo(() => chain.flatMap((s, si) => (s.items ?? []).map((_, ii) => ({ si, ii }))), [chain]);
  const flatIndex = flat.findIndex((f) => f.si === pos.set && f.ii === pos.item);
  const activeSet = chain[pos.set];
  const activeItem = activeSet?.items?.[pos.item];

  async function pollSet(setId: string): Promise<SetRow> {
    for (;;) {
      const s = await api<SetRow>('GET', `/suggestions/${setId}`);
      if (s.status !== 'running') return s;
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  async function ask(more = false) {
    if (!instruction.trim() || asking) return;
    setAskErr(''); setStatus(null);
    const ok = await flush();
    if (!ok) { setAskErr('Save your lyric first: ' + (saveState.msg ?? 'not saved yet.')); return; }
    const el = editor.current;
    const fresh = await api<WS>('GET', `/songs/${id}`);
    const cur = el ? (touched.current ? mapSelection(el.value, sel.current.start, sel.current.end, fresh.sections) : mapSelection(el.value, el.value.length, el.value.length, fresh.sections)) : null;
    const base = more && activeSet ? activeSet : null;
    let targets: Target[], afterLineId: string | null;
    if (base) { targets = base.targets.targets; afterLineId = base.targets.afterLineId; }
    else {
      if (!cur || cur.stale) { setAskErr('Your lyric is still saving. Try again in a moment.'); return; }
      targets = cur.targets; afterLineId = cur.afterLineId;
    }
    setAsking(true);
    try {
      const w = await refresh(false);
      const r = await api<{ setId: string }>('POST', `/songs/${id}/suggest`, {
        baseRev: w.current_rev, targets, afterLineId, instruction, clientKey: clientKey(), parentSetId: base ? (base.parent_id ?? base.id) : null,
      });
      const set = await pollSet(r.setId);
      if (set.status === 'failed' || !set.items?.length) {
        setAskErr(set.error?.message ?? 'Nothing usable came back. Try rephrasing.');
      } else if (base) {
        setChain((c) => [...c, set]); setPos({ set: chain.length, item: 0 });
      } else {
        setChain([set]); setPos({ set: 0, item: 0 });
      }
      await refresh(false);
    } catch (e) {
      const ae = e as ApiError;
      setAskErr(ae.code === 'conflict' || ae.code === 'stale_selection' ? 'That line changed since. Select it again.' : ae.message);
    }
    setAsking(false);
  }
  function prev() { if (flatIndex > 0) { const f = flat[flatIndex - 1]; setPos({ set: f.si, item: f.ii }); } }
  function next() {
    if (flatIndex < flat.length - 1) { const f = flat[flatIndex + 1]; setPos({ set: f.si, item: f.ii }); }
    else void ask(true);
  }
  async function keep() {
    if (!activeSet || !activeItem || !ws) return;
    const before = ws.current_rev;
    try {
      const r = await api<{ rev: number }>('POST', `/songs/${id}/keep`, { setId: activeSet.id, index: pos.item, clientKey: `${activeSet.id}:${pos.item}` });
      await refresh(true);
      setChain([]);
      setStatus({ text: 'Kept. The previous version is in History.', undo: { rev: before, base: r.rev } });
    } catch (e) { setStatus({ text: (e as Error).message, err: true }); }
  }
  async function undo(u: { rev: number; base: number }) {
    try { await api('POST', `/songs/${id}/restore`, { rev: u.rev, baseRev: u.base }); await refresh(true); setStatus({ text: 'Undone.' }); }
    catch (e) { setStatus({ text: (e as Error).message, err: true }); }
  }
  async function saveProposal() {
    if (!activeItem) return;
    const t = activeItem.lines ? activeItem.lines.join('\n') : (activeItem.diff ?? []).map((d) => d.after).join('\n');
    try {
      const f = await api<Fragment>('POST', '/fragments', { songId: id, text: t, source: 'suggestion', clientKey: `${activeSet!.id}:${pos.item}:frag` });
      await api('PATCH', `/fragments/${f.id}`, { saved: true });
      await refresh(false);
      setStatus({ text: 'Saved as a scrap (and in your journal). Your lyric is unchanged.' });
    } catch (e) { setStatus({ text: (e as Error).message, err: true }); }
  }

  // ---------------- scraps ----------------
  const [scrap, setScrap] = useState(() => draftStore.get(`scrap:${id}`));
  async function addScrap() {
    try {
      await api('POST', '/fragments', { songId: id, text: scrap, clientKey: `${id}:scrap:${scrap.length}:${Date.now() >> 12}` });
      setScrap(''); draftStore.set(`scrap:${id}`, ''); await refresh(false);
    } catch (e) { setStatus({ text: (e as Error).message, err: true }); }
  }
  async function addToLyrics(text: string, source: 'seed' | 'scrap', key: string) {
    const ok = await flush(); if (!ok) { setStatus({ text: 'Save your lyric first.', err: true }); return; }
    const el = editor.current;
    const w = await refresh(false);
    const m = el && touched.current ? mapSelection(el.value, sel.current.end, sel.current.end, w.sections) : null;
    // where his cursor is if he put it in the draft; otherwise the end of the draft, in its last section
    const lastLine = w.sections.at(-1)?.lines.at(-1)?.id ?? null;
    const after = m && !m.stale ? (m.afterLineId ?? lastLine) : lastLine;
    try {
      const before = w.current_rev;
      const r = await api<{ rev: number }>('POST', `/songs/${id}/add`, { baseRev: w.current_rev, afterLineId: after, text, source, clientKey: `${key}:${before}` });
      await refresh(true);
      setStatus({ text: 'Added to your draft.', undo: { rev: before, base: r.rev } });
    } catch (e) { setStatus({ text: (e as Error).message, err: true }); }
  }
  const [moreAsk, setMoreAsk] = useState(() => draftStore.get(`more:${id}`));
  const [moreRun, setMoreRun] = useState<string | null>(null);
  const [moreErr, setMoreErr] = useState('');
  async function moreLines() {
    if (moreRun) return;
    setMoreErr('');
    try {
      const r = await api<{ runId: string }>('POST', `/songs/${id}/lines`, { ask: moreAsk, clientKey: clientKey() });
      setMoreRun(r.runId);
      const run = await waitForRun(r.runId);
      if (run.status !== 'succeeded') setMoreErr(run.error?.message ?? 'That didn’t work. Your page is unchanged.');
      else { setMoreAsk(''); draftStore.set(`more:${id}`, ''); }
      await refresh(false);
    } catch (e) { setMoreErr((e as Error).message); }
    setMoreRun(null);
  }
  // ---------------- titles for the next section (13 Oct) ----------------
  const [titleAsk, setTitleAsk] = useState(() => draftStore.get(`titles:${id}`));
  const [titleRun, setTitleRun] = useState<string | null>(null);
  const [titleErr, setTitleErr] = useState('');
  const [titlesOpen, setTitlesOpen] = useState(false);
  useEffect(() => {
    // a set still being written when the page opens (he came here from Write): follow it
    const running = ws?.titles?.find((t) => t.status === 'running');
    if (running?.run_id && !titleRun) setTitleRun(running.run_id);
  }, [ws?.titles]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!titleRun) return;
    let stop = false;
    (async () => {
      try { const run = await waitForRun(titleRun); if (stop) return; if (run.status !== 'succeeded') setTitleErr(run.error?.message ?? 'That didn’t work.'); else { setTitleErr(''); setTitleAsk(''); draftStore.set(`titles:${id}`, ''); } }
      catch (e) { if (!stop) setTitleErr((e as Error).message); }
      if (!stop) { setTitleRun(null); await refresh(false); }
    })();
    return () => { stop = true; };
  }, [titleRun]); // eslint-disable-line react-hooks/exhaustive-deps
  async function findTitles() {
    if (titleRun) return;
    setTitleErr('');
    try { const r = await api<{ runId: string }>('POST', `/songs/${id}/titles`, { ask: titleAsk, clientKey: clientKey() }); setTitleRun(r.runId); setTitlesOpen(false); }
    catch (e) { setTitleErr((e as Error).message); }
  }
  async function useTitle(setId: string, index: number) {
    try { const w = await api<WS>('POST', `/songs/${id}/titles/use`, { setId, index }); setWs(w); setStatus({ text: `Title: ${w.title}. Its lines are on the page; tap them into your draft.` }); window.scrollTo(0, 0); }
    catch (e) { setStatus({ text: (e as Error).message, err: true }); }
  }
  async function saveScrap(f: Fragment) {
    if (f.saved) return;
    await api('PATCH', `/fragments/${f.id}`, { saved: true }).catch((e) => setStatus({ text: e.message, err: true }));
    await refresh(false);
  }
  async function removeScrap(f: Fragment) {
    if (f.saved && !confirm('This scrap is in your journal. Remove it everywhere?')) return;
    await api('DELETE', `/fragments/${f.id}`).catch(() => {}); await refresh(false);
  }

  // ---------------- context ----------------
  async function patchContext(p: Record<string, unknown>) {
    try { const c = await api<Ctx>('PATCH', `/songs/${id}/context`, p); setWs((w) => (w ? { ...w, context: c } : w)); }
    catch (e) { toast((e as Error).message); }
  }
  async function toggleLock() {
    if (!ws || !selInfo || selInfo.stale) return;
    const lid = selInfo.targets[0]?.lineId ?? selInfo.afterLineId;
    if (!lid) return;
    const locks = ws.locks.includes(lid) ? ws.locks.filter((x) => x !== lid) : [...ws.locks, lid];
    await api('PATCH', `/songs/${id}`, { locks }).catch((e) => toast(e.message));
    await refresh(false);
  }

  if (loadErr) return <div className="status err" role="alert">{loadErr}</div>;
  if (!ws || !saved) return <Pending text="Opening the song…" />;

  const c = ws.context;
  const lyricLines = new Set(text.split('\n').map((l) => l.trim()));
  const lockedLines = ws.locks.map((l) => lineById(l)).filter(Boolean) as Array<{ id: string; text: string }>;
  const cursorLine = selInfo && !selInfo.stale ? (selInfo.targets[0]?.lineId ?? selInfo.afterLineId) : null;

  const inDraft = (t: string) => lyricLines.has(t.trim());
  const typed = ws.scraps.filter((f) => f.source !== 'writer');
  const fromWriter = ws.scraps.filter((f) => f.source === 'writer');
  const groups: Array<{ ask: string; items: Fragment[] }> = [];
  for (const f of fromWriter) {
    const ask = f.ask ?? '';
    const g = groups.at(-1);
    if (g && g.ask === ask) g.items.push(f); else groups.push({ ask, items: [f] });
  }
  const hasDraft = ws.sections.some((sec) => sec.lines.length);
  const tap = (t: string, key: string) => addToLyrics(t, 'scrap', key);

  return (
    <div className={palClass(ws.palette)}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        {ws.idea ? <a className="tb under" style={{ paddingLeft: 0 }} href={`#/idea/${ws.idea.id}`}>← Idea</a> : <a className="tb under" style={{ paddingLeft: 0 }} href="#/journal">← Journal</a>}
        <button className="tb" onClick={() => setPanel('menu')} aria-label="Song menu">More ⋯</button>
      </div>
      <div className="topline"><span className="eyebrow">Song page</span></div>
      <TitleStrips title={ws.title || 'Untitled'} parts={ws.idea && ws.idea.title === ws.title ? ws.idea.title_parts : null} />
      {(ws.idea?.concept || ws.brief) && <p className="concept">{ws.idea?.concept || ws.brief}</p>}

      {/* the page: lines to pick from */}
      <section className="page-lines" aria-label="Lines on this page">
        <div className="hand">Tap a line to put it in your draft</div>
        {ws.idea && !!ws.idea.lines.length && (
          <div className="seed">
            <div className="eyebrow">From the idea</div>
            <div className="seed-lines markable-lines">
              {ws.idea.lines.map((l) => <PageLine key={l.id} text={l.text} done={inDraft(l.text)} onTap={() => tap(l.text, `seedline:${l.id}`)} />)}
            </div>
          </div>
        )}
        {groups.map((g, gi) => (
          <div className="page-group" key={gi}>
            <div className="eyebrow">{g.ask ? `You asked: ${g.ask}` : 'More lines'}</div>
            {g.items.map((f) => <PageLine key={f.id} text={f.text} done={inDraft(f.text)} onTap={() => tap(f.text, `scrap:${f.id}`)} onRemove={() => removeScrap(f)} />)}
          </div>
        ))}
        {/* titles for the next section */}
        <div className="titles-block">
          {(ws.titles ?? []).map((t, ti) => (
            <div className="page-group" key={t.id}>
              <div className="eyebrow">{ti === 0 ? 'Titles for the next section' : 'Earlier titles'}{t.ask ? ` · you asked: ${t.ask}` : ''}</div>
              {t.status === 'running' && <Pending text="Reading your lyric for its title… about half a minute." />}
              {t.status === 'failed' && <div className="status err" role="alert">{t.error?.message ?? 'That didn’t work.'}</div>}
              {t.status === 'done' && t.error?.code === 'note' && <p className="small muted">{t.error.message}</p>}
              {t.status === 'done' && (t.items ?? []).map((it, i) => (
                <div className={`title-card ${ws.title === it.title ? 'is-current' : ''}`} key={i}>
                  <div className="title-card-title">{it.title}</div>
                  {it.why && <div className="small muted">{it.why}</div>}
                  <div className="title-card-lines">{it.lines.join('\n')}</div>
                  <div className="hang-actions">
                    <button className="tb accent" onClick={() => useTitle(t.id, i)}>{ws.title === it.title ? 'This is the title ✓' : 'Use this title'}</button>
                    {it.lines.map((l, k) => <button key={k} className="tb" disabled={inDraft(l)} onClick={() => tap(l, `title:${t.id}:${i}:${k}`)}>{inDraft(l) ? `Line ${k + 1} in draft` : `Line ${k + 1} → draft`}</button>)}
                  </div>
                </div>
              ))}
            </div>
          ))}
          {titlesOpen ? (
            <div className="more-lines">
              <Composer value={titleAsk} onChange={(v) => { setTitleAsk(v); draftStore.set(`titles:${id}`, v); }} onSubmit={findTitles} busy={!!titleRun}
                placeholder="What you need… e.g. the chorus title, big and simple" label="What the next section needs" submitLabel={titleRun ? 'Reading…' : 'Find the title'} submitAria="Find titles for the next section" />
              {!titleAsk.trim() && !titleRun && <button className="tb under" style={{ paddingLeft: 0 }} onClick={findTitles}>Just find me the title</button>}
            </div>
          ) : (
            <button className="tb under" style={{ paddingLeft: 0 }} disabled={!!titleRun} onClick={() => setTitlesOpen(true)}>{(ws.titles ?? []).length ? 'Eight more titles' : 'Find the title for the next section'}</button>
          )}
          {titleRun && !(ws.titles ?? []).some((t) => t.status === 'running') && <div style={{ marginTop: 6 }}><Pending text="Reading your lyric for its title…" /></div>}
          {titleErr && <div className="status err" role="alert">{titleErr}</div>}
        </div>
        <div className="more-lines">
          <Composer value={moreAsk} onChange={(v) => { setMoreAsk(v); draftStore.set(`more:${id}`, v); }} onSubmit={moreLines} busy={!!moreRun}
            placeholder="More lines… e.g. a sexier chorus line, more about the car" label="Ask for more lines for this page" submitLabel={moreRun ? 'Writing…' : 'More lines'} submitAria="Get more lines" />
          {!moreAsk.trim() && !moreRun && <button className="tb under" style={{ paddingLeft: 0 }} onClick={moreLines}>Just give me more lines</button>}
          {moreRun && <div style={{ marginTop: 6 }}><Pending text="Writing more lines for this page…" /></div>}
          {moreErr && <div className="status err" role="alert">{moreErr}</div>}
        </div>
        {!!typed.length && <div className="hand" style={{ marginTop: 18 }}>Your scraps</div>}
        <FragmentList items={typed} onAdd={(f) => addToLyrics(f.text, 'scrap', `scrap:${f.id}`)} onSave={saveScrap} onRemove={removeScrap} />
        <Composer value={scrap} onChange={(v) => { setScrap(v); draftStore.set(`scrap:${id}`, v); }} onSubmit={addScrap}
          placeholder="Your own scrap: a phrase, a memory, half a line…" label="Add a scrap to this song" submitAria="Add scrap" />
      </section>

      <div className={`status ${status?.err ? 'err' : ''}`} role="status" aria-live="polite">
        {status?.text}{status?.undo && <button className="tb under" onClick={() => undo(status.undo!)}>Undo</button>}
      </div>

      {/* the draft: what he has picked, growing into a lyric sheet */}
      <div className="editor-label">
        <label className="eyebrow" htmlFor="lyric-editor">Your draft</label>
        <span className={`small ${saveState.s === 'error' ? '' : 'muted'}`} role="status" aria-live="polite" style={saveState.s === 'error' ? { color: 'var(--warn)' } : undefined}>
          {saveState.s === 'saving' ? 'Saving…' : saveState.s === 'saved' ? 'Saved' : saveState.s === 'error' ? saveState.msg : ''}
          {saveState.s === 'error' && <button className="tb under" style={{ minHeight: 32 }} onClick={() => { dirtyRef.current = true; void flush(); }}>Retry</button>}
        </span>
      </div>
      <textarea id="lyric-editor" ref={editor} className="lyric-editor" value={text} placeholder={'Empty for now. Tap lines above and they land here, or type.'}
        onChange={(e) => onEdit(e.target.value)} onSelect={trackSelection} onKeyUp={trackSelection} onMouseUp={trackSelection} onTouchEnd={trackSelection}
        onBlur={() => { trackSelection(); void flush(); }} rows={Math.min(24, Math.max(hasDraft ? 6 : 3, text.split('\n').length + 1))} spellCheck />
      {!!lockedLines.length && <div className="locks">Locked: {lockedLines.map((l, i) => <span key={l.id}>{i ? ' · ' : ''}“{l.text}”</span>)}</div>}

      {/* change something in the draft */}
      {hasDraft && <div className="ask">
        <div className="target" aria-live="polite">
          {(!targetLabel || !touched.current) && 'Select words or a line in your draft to change them, or put the cursor where new lines should go.'}
          {touched.current && targetLabel?.kind === 'span' && <>Changing <b>{targetLabel.mark}</b> in “{targetLabel.before}<b>{targetLabel.mark}</b>{targetLabel.after}”</>}
          {touched.current && targetLabel?.kind === 'lines' && <>Changing <b>{targetLabel.text}</b></>}
          {touched.current && targetLabel?.kind === 'add' && targetLabel.text}
          {touched.current && cursorLine && <button className="tb under" style={{ minHeight: 32, padding: '2px 8px' }} onClick={toggleLock}>{ws.locks.includes(cursorLine) ? 'Unlock line' : 'Lock line'}</button>}
        </div>
        <div className="ask-row">
          <textarea rows={1} ref={askRef} value={instruction} aria-label="What should change"
            placeholder={targetLabel?.kind === 'add' ? 'e.g. a pre-chorus that turns it' : 'e.g. keep the rhythm, less sincere'}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(false); } }} />
          <button className="tb" disabled={!instruction.trim() || asking} onClick={() => ask(false)}>{asking ? '…' : 'Suggest'}</button>
        </div>
        <ContextRow c={c} onEdit={() => setPanel('context')} onPatch={patchContext} />
        {asking && <div style={{ marginTop: 10 }}><Pending text="Finding options…" /></div>}
        {askErr && <div className="status err" role="alert">{askErr}</div>}
      </div>}

      {/* one proposal at a time */}
      {activeSet && activeItem && (
        <section className="proposal" aria-label="Suggestion">
          {activeSet.mode === 'replace' && activeItem.diff?.map((d) => <ContextLines key={d.lineId} sections={saved.sections} lineId={d.lineId} targets={activeSet.targets.targets} />)}
          {activeSet.mode === 'add' && <div className="context-lines">{activeSet.targets.afterLineId ? <>After <span className="cur">“{lineById(activeSet.targets.afterLineId)?.text}”</span></> : 'At the end'}</div>}
          <div className={`strip ${activeItem.direct ? 'direct' : ''}`} aria-live="polite">
            {activeItem.lines ? activeItem.lines.join('\n') : activeItem.diff!.map((d, i) => (
              <span key={d.lineId}>{i ? '\n' : ''}{changedWords(d.before, d.after).map((w, k) => (w.changed ? <em key={k}>{w.t}</em> : <span key={k}>{w.t}</span>))}</span>
            ))}
          </div>
          {!!activeItem.checks.length && <div className="checks">{activeItem.checks.map((k, i) => <span key={i} className={`chk ${k.ok ? 'ok' : 'no'}`}>{k.ok ? '✓' : '✗'} {k.label}</span>)}</div>}
          {activeSet.error?.code === 'note' && <div className="small muted" style={{ marginTop: 8 }}>{activeSet.error.message}</div>}
          {activeItem.direct && <div className="small muted" style={{ marginTop: 8 }}>A direct change: no writer used.</div>}
          <div className="prop-nav">
            <button className="tb" onClick={prev} disabled={flatIndex <= 0}>← Previous</button>
            <span className="count">{flatIndex + 1} of {flat.length}</span>
            <button className="tb accent" onClick={next} disabled={asking || (activeItem.direct && flatIndex >= flat.length - 1)}>{flatIndex < flat.length - 1 ? 'Next →' : 'Another →'}</button>
          </div>
          <div className="actions">
            <button className="secondary" onClick={saveProposal}>Save fragment</button>
            <button className="primary" onClick={keep}>Keep</button>
          </div>
        </section>
      )}
      <EarlierSets sets={ws.sets.filter((s) => !chain.some((c) => c.id === s.id))} onShow={(s) => { setChain([s]); setPos({ set: 0, item: 0 }); window.scrollTo({ top: editor.current?.offsetTop ?? 0 }); }} />

      <div className="actions" style={{ marginTop: 22 }}>
        {ws.idea ? <button className="secondary" onClick={() => go(`/idea/${ws.idea!.id}`)}>← Back to idea</button> : null}
        <button className="secondary" onClick={() => go('/journal')}>Journal</button>
      </div>

      {panel === 'menu' && (
        <Overlay title="This song" onClose={() => setPanel(null)}>
          <button className="list-btn" onClick={() => setPanel('notes')}><span className="t">Title & song notes</span><small>What the writer should know about this song</small></button>
          <button className="list-btn" onClick={() => setPanel('context')}><span className="t">Rhyme, rhythm, meaning, reference</span><small>The context every suggestion keeps</small></button>
          <button className="list-btn" onClick={() => setPanel('history')}><span className="t">History</span><small>Every version; restore any of them</small></button>
          <button className="list-btn" onClick={() => setPanel('suno')}><span className="t">Suno prompt</span><small>Style and section tags around your exact words</small></button>
          <button className="list-btn" onClick={() => { void copy(render(saved.sections)).then((ok) => toast(ok ? 'Lyrics copied' : 'Copy failed')); setPanel(null); }}><span className="t">Copy lyrics</span></button>
          <button className="list-btn" onClick={async () => { if (confirm('Delete this song and all its versions? This can’t be undone.')) { await api('DELETE', `/songs/${id}`); go('/journal'); } }}><span className="t" style={{ color: 'var(--warn)' }}>Delete song</span></button>
        </Overlay>
      )}
      {panel === 'context' && <ContextPanel c={c} cursorLine={cursorLine ? lineById(cursorLine) ?? null : null} selection={selInfo && !selInfo.stale ? selInfo.targets : []} onClose={() => setPanel(null)} onPatch={patchContext} />}
      {panel === 'notes' && <NotesPanel ws={ws} onClose={() => setPanel(null)} onSaved={() => refresh(false)} />}
      {panel === 'history' && <HistoryPanel ws={ws} onClose={() => setPanel(null)} onRestored={async () => { await refresh(true); setPanel(null); }} />}
      {panel === 'suno' && <SunoPanel ws={ws} onClose={() => setPanel(null)} onBuilt={() => refresh(false)} />}
    </div>
  );
}

function PageLine({ text, done, onTap, onRemove }: { text: string; done: boolean; onTap: () => void; onRemove?: () => void }) {
  return (
    <div className={`page-line ${done ? 'is-in' : ''}`}>
      <button type="button" className="line-mark" onClick={onTap} aria-label={done ? `${text}. Already in your draft; tap to add it again` : `Add “${text}” to your draft`}>
        <span className="t">{text}</span><span className="mark-tag">{done ? 'in draft' : '+ draft'}</span>
      </button>
      {onRemove && <button type="button" className="tb" onClick={onRemove} aria-label="Remove this line from the page">×</button>}
    </div>
  );
}

function ContextLines({ sections, lineId, targets }: { sections: Section[]; lineId: string; targets: Target[] }) {
  const lines = allLines(sections);
  const i = lines.findIndex((l) => l.id === lineId);
  if (i < 0) return null;
  const t = targets.find((x) => x.lineId === lineId);
  const cur = lines[i].text;
  return (
    <div className="context-lines">
      {i > 0 && <div>{lines[i - 1].text}</div>}
      <div className="cur">{t?.kind === 'span' ? <>{cur.slice(0, t.start)}<mark>{cur.slice(t.start, t.end)}</mark>{cur.slice(t.end)}</> : <mark>{cur}</mark>}</div>
      {i < lines.length - 1 && <div>{lines[i + 1].text}</div>}
    </div>
  );
}

function ContextRow({ c, onEdit, onPatch }: { c: Ctx; onEdit: () => void; onPatch: (p: Record<string, unknown>) => void }) {
  const bits: Array<[string, string]> = [];
  if (c.rhyme) bits.push(['rhyme', `${c.rhyme.word}${c.rhyme.mode === 'linked' ? ' (follows its line)' : ''}`]);
  if (c.rhythm) bits.push(['rhythm', `≈${c.rhythm.syllables} syllable${c.rhythm.syllables === 1 ? '' : 's'}, like “${c.rhythm.sample.slice(0, 40)}${c.rhythm.sample.length > 40 ? '…' : ''}”`]);
  if (c.meaning) bits.push(['meaning', c.meaning]);
  if (c.narrator) bits.push(['voice', c.narrator]);
  if (c.refs.length) bits.push(['ref', c.refs.map(refSummary).join(', ')]);
  return (
    <>
      <div className="ctx-row">
        {bits.map(([k, v]) => <span key={k}><span className="k">{k}: </span><span className="v">{v}</span></span>)}
        <button className="tb under" onClick={onEdit}>{bits.length ? 'Edit' : 'Rhyme, rhythm, meaning, reference'}</button>
      </div>
      {c.rhyme?.notice && c.rhyme.notice.from !== c.rhyme.notice.to && (
        <div className="notice">Rhyme target followed its line: “{c.rhyme.notice.from}” → “{c.rhyme.notice.to}”.
          <button className="tb under" style={{ minHeight: 32 }} onClick={() => onPatch({ clearNotice: true })}>OK</button>
          <button className="tb under" style={{ minHeight: 32 }} onClick={() => onPatch({ rhyme: { word: c.rhyme!.notice!.from } })}>Keep “{c.rhyme.notice.from}”</button>
        </div>
      )}
      {c.rhyme?.notice && c.rhyme.notice.from === c.rhyme.notice.to && (
        <div className="notice">The line the rhyme came from is gone; keeping “{c.rhyme.word}” fixed. <button className="tb under" style={{ minHeight: 32 }} onClick={() => onPatch({ clearNotice: true })}>OK</button></div>
      )}
    </>
  );
}

function ContextPanel({ c, cursorLine, selection, onClose, onPatch }: { c: Ctx; cursorLine: { id: string; text: string } | null; selection: Target[]; onClose: () => void; onPatch: (p: Record<string, unknown>) => Promise<void> | void }) {
  const [rhyme, setRhyme] = useState(c.rhyme?.word ?? '');
  const [rhythm, setRhythm] = useState(c.rhythm?.sample ?? '');
  const [meaning, setMeaning] = useState(c.meaning);
  const [narrator, setNarrator] = useState(c.narrator);
  const selText = selection.map((t) => t.expected).join(' / ');
  return (
    <Overlay title="What suggestions keep" onClose={onClose}>
      <label className="fld">Rhyme target {c.rhyme?.mode === 'linked' && <span>(follows “{c.rhyme.line}”)</span>}
        <input className="line" value={rhyme} onChange={(e) => setRhyme(e.target.value)} placeholder="e.g. mode" />
      </label>
      <div className="row">
        <button className="tb under" disabled={!rhyme.trim()} onClick={() => onPatch({ rhyme: { word: rhyme } })}>Use this word</button>
        {cursorLine && <button className="tb under" onClick={() => onPatch({ rhyme: { lineId: cursorLine.id } })}>Rhyme with the end of “{cursorLine.text.length > 34 ? '…' + cursorLine.text.slice(-32) : cursorLine.text}”</button>}
        {c.rhyme && <button className="tb under" onClick={() => { setRhyme(''); void onPatch({ rhyme: null }); }}>No rhyme target</button>}
      </div>
      <label className="fld">Rhythm: a phrase whose shape to keep
        <input className="line" value={rhythm} onChange={(e) => setRhythm(e.target.value)} placeholder="e.g. Red toes in stilettos make your blood flow" />
      </label>
      <div className="row">
        <button className="tb under" disabled={!rhythm.trim()} onClick={() => onPatch({ rhythm: { sample: rhythm } })}>Use this</button>
        {selText && <button className="tb under" onClick={() => { setRhythm(selText); void onPatch({ rhythm: { sample: selText } }); }}>Use the selection</button>}
        {c.rhythm && <button className="tb under" onClick={() => { setRhythm(''); void onPatch({ rhythm: null }); }}>None</button>}
      </div>
      <p className="small muted">Syllable counts are rough; only your ear knows if it sits on the melody.</p>
      <label className="fld">What it means right now {c.meaningSource === 'instruction' && <span>(picked up from your instruction)</span>}
        <input className="line" value={meaning} onChange={(e) => setMeaning(e.target.value)} onBlur={() => meaning !== c.meaning && onPatch({ meaning })} placeholder="e.g. pretending not to care" />
      </label>
      <label className="fld">Who’s singing, to whom
        <input className="line" value={narrator} onChange={(e) => setNarrator(e.target.value)} onBlur={() => narrator !== c.narrator && onPatch({ narrator })} placeholder="e.g. her, to the ex" />
      </label>
      <div className="eyebrow" style={{ marginTop: 16 }}>Reference</div>
      {c.refs.map((r) => (
        <div key={r.id} className="row" style={{ justifyContent: 'space-between' }}>
          <span>{refSummary(r)}{r.want ? `: ${r.want}` : ''}</span>
          <button className="tb under" onClick={() => onPatch({ refIds: c.refs.filter((x) => x.id !== r.id).map((x) => x.id) })}>Remove</button>
        </div>
      ))}
      {c.refs.length < 3 && <RefChecker value={null} onChange={(r) => { if (r && r.status !== 'pending') void onPatch({ refIds: [...c.refs.map((x) => x.id), r.id] }); }} />}
    </Overlay>
  );
}

function EarlierSets({ sets, onShow }: { sets: SetRow[]; onShow: (s: SetRow) => void }) {
  const usable = sets.filter((s) => s.items?.length);
  if (!usable.length) return null;
  return (
    <details className="earlier">
      <summary>Earlier suggestions ({usable.length})</summary>
      {usable.map((s) => (
        <div className="item" key={s.id}>
          <span><span className="muted">{s.instruction.slice(0, 60)}</span>{'\n'}{(s.items![0].lines ?? s.items![0].diff?.map((d) => d.after) ?? []).join(' / ').slice(0, 90)}</span>
          <button className="tb under" onClick={() => onShow(s)}>Show</button>
        </div>
      ))}
    </details>
  );
}

function NotesPanel({ ws, onClose, onSaved }: { ws: WS; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(ws.title);
  const [brief, setBrief] = useState(ws.brief);
  const [notes, setNotes] = useState(ws.notes);
  const [err, setErr] = useState('');
  return (
    <Overlay title="Title & song notes" onClose={onClose}>
      <label className="fld">Title<input className="line" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="fld">What the writer should know (who’s singing, the situation, settled facts)<textarea className="box" rows={4} value={brief} onChange={(e) => setBrief(e.target.value)} /></label>
      <label className="fld">Private notes (never sent to the writer)<textarea className="box" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      {err && <div className="status err">{err}</div>}
      <div className="actions" style={{ margin: '8px 0' }}>
        <button className="secondary" onClick={onClose}>Cancel</button>
        <button className="primary" onClick={async () => { try { await api('PATCH', `/songs/${ws.id}`, { title, brief, notes }); onSaved(); onClose(); } catch (e) { setErr((e as Error).message); } }}>Save</button>
      </div>
    </Overlay>
  );
}

function HistoryPanel({ ws, onClose, onRestored }: { ws: WS; onClose: () => void; onRestored: () => void }) {
  const [revs, setRevs] = useState<Array<{ rev: number; source: string; note: string; created_at: string; sections: Section[] }> | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => { api('GET', `/songs/${ws.id}/revisions`).then(setRevs).catch(() => setRevs([])); }, [ws.id]);
  const what = (s: string) => ({ created: 'Started', typed: 'Typed', 'edit:direct': 'Direct change', 'edit:writer': 'Kept a suggestion', draft: 'Used a draft', restore: 'Restored', 'insert:writer': 'Added suggested lines', 'insert:seed': 'Added the first thread', 'insert:scrap': 'Added a scrap' } as Record<string, string>)[s] ?? s;
  // Consecutive typing autosaves read as one entry.
  const grouped = (revs ?? []).filter((r, i, a) => !(r.source === 'typed' && a[i - 1]?.source === 'typed'));
  return (
    <Overlay title="History" onClose={onClose}>
      {!revs && <Pending text="Loading…" />}
      {grouped.map((r) => (
        <div key={r.rev}>
          <button className="list-btn" onClick={() => setOpen(open === r.rev ? null : r.rev)} aria-expanded={open === r.rev}>
            <span className="t" style={{ fontSize: 16, fontFamily: 'var(--sans)' }}>Version {r.rev}{r.rev === ws.current_rev ? ' (current)' : ''}: {what(r.source)}</span>
            <small>{new Date(r.created_at).toLocaleString()}{r.note ? ` · ${r.note.slice(0, 60)}` : ''}</small>
          </button>
          {open === r.rev && (
            <div style={{ padding: '8px 0 14px' }}>
              <div className="code">{render(r.sections) || '(empty)'}</div>
              {r.rev !== ws.current_rev && <button className="secondary" style={{ marginTop: 8 }} onClick={async () => { await api('POST', `/songs/${ws.id}/restore`, { rev: r.rev, baseRev: ws.current_rev }); onRestored(); }}>Restore this version</button>}
            </div>
          )}
        </div>
      ))}
    </Overlay>
  );
}

function SunoPanel({ ws, onClose, onBuilt }: { ws: WS; onClose: () => void; onBuilt: () => void }) {
  const [hint, setHint] = useState(ws.suno?.hint ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { toast } = useApp();
  const s = ws.suno;
  const cp = (t: string) => void copy(t).then((ok) => toast(ok ? 'Copied' : 'Copy failed'));
  return (
    <Overlay title="Suno prompt" onClose={onClose}>
      <label className="fld">Production direction (optional)<textarea className="box" rows={2} value={hint} onChange={(e) => setHint(e.target.value)} placeholder="e.g. stripped back until the last chorus, female vocal" /></label>
      <button className="primary" disabled={busy || !ws.sections.length} onClick={async () => {
        setBusy(true); setErr('');
        try {
          const r = await api<{ runId: string }>('POST', `/songs/${ws.id}/suno`, { hint, clientKey: clientKey() });
          for (;;) { const run = await api('GET', `/runs/${r.runId}`); if (run.status !== 'running') { if (run.status !== 'succeeded') setErr(run.error?.message ?? 'That failed.'); break; } await new Promise((x) => setTimeout(x, 1500)); }
          onBuilt();
        } catch (e) { setErr((e as Error).message); }
        setBusy(false);
      }}>{busy ? 'Building…' : s ? 'Rebuild' : 'Build Suno prompt'}</button>
      {err && <div className="status err">{err}</div>}
      {s && <>
        {s.rev !== ws.current_rev && <p className="small" style={{ color: 'var(--warn)' }}>The lyric changed since this was built. Rebuild to match.</p>}
        <div className="blockhead"><h3>Style</h3><button className="tb under" onClick={() => cp(s.style)}>Copy</button></div>
        <div className="code">{s.style}</div>
        {s.exclude && <><div className="blockhead"><h3>Exclude</h3><button className="tb under" onClick={() => cp(s.exclude)}>Copy</button></div><div className="code">{s.exclude}</div></>}
        <div className="blockhead"><h3>Lyrics</h3><button className="tb under" onClick={() => cp(s.lyrics)}>Copy</button></div>
        <div className="code">{s.lyrics}</div>
        <p className="small muted">Your words exactly; only bracketed tags added. Use Custom mode in Suno.</p>
      </>}
    </Overlay>
  );
}
