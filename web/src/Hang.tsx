// The hang: the hour of talk before a session, read afterwards for titles, concepts and
// lines. Paste a transcript (works with no setup) or upload the recording (needs a
// transcription key). The transcript is kept only until the candidates are out.

import { useEffect, useRef, useState } from 'react';
import { api, ApiError, draftStore } from './api';
import { Pending, Overlay } from './paper';
import { go, useApp } from './App';

type Candidate = { kind: 'title' | 'concept' | 'line'; text: string; saidBy: string; at: string; context: string; why: string; score: number };
type HangRow = { id: string; title: string; status: string; source: string; minutes: number | null; speakers: number | null; candidates: Candidate[]; dismissed: number[]; error: { code: string; message: string } | null; created_at: string };
type Summary = Omit<HangRow, 'candidates'> & { candidates: number };

const KINDS: Array<[Candidate['kind'], string]> = [['title', 'Titles'], ['concept', 'Concepts'], ['line', 'Lines']];
const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export function HangPage({ id }: { id?: string }) {
  return id ? <HangDetail id={id} /> : <HangList />;
}

function HangList() {
  const { status, toast } = useApp();
  const [rows, setRows] = useState<Summary[] | null>(null);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState<null | 'paste' | 'upload'>(null);
  const [title, setTitle] = useState(() => draftStore.get('hang:title'));
  const [text, setText] = useState(() => draftStore.get('hang:text'));
  const [busy, setBusy] = useState<string>('');
  const file = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const canUpload = !!status?.transcriber?.configured;

  const load = () => api<Summary[]>('GET', '/hangs').then((r) => { setRows(r); setErr(''); }).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);

  async function paste() {
    setBusy('Reading…');
    try {
      const r = await api<{ id: string }>('POST', '/hangs', { title, text });
      draftStore.set('hang:text', ''); draftStore.set('hang:title', ''); setText(''); setTitle('');
      go(`/hang/${r.id}`);
    } catch (e) { toast((e as Error).message); }
    setBusy('');
  }
  async function upload() {
    if (!picked) return;
    setBusy('Uploading…');
    try {
      const res = await fetch(`/api/hangs/audio?title=${encodeURIComponent(title)}`, { method: 'POST', headers: { 'content-type': picked.type || 'application/octet-stream', 'x-songroom': '1' }, body: picked });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(res.status, body.error?.code ?? 'error', body.error?.message ?? `Upload failed (${res.status}).`);
      draftStore.set('hang:title', ''); setTitle(''); setPicked(null);
      go(`/hang/${body.id}`);
    } catch (e) { toast((e as Error).message); }
    setBusy('');
  }

  return (
    <div className="pal-sage">
      <div className="eyebrow">Before the writing starts</div>
      <h2 className="page-title">The hang.</h2>
      <p className="concept">Record the hour of talk before a session, or paste its transcript, and get back the things said that could be a title, a concept or a line. The recording and transcript are deleted once they've been read; only the candidates stay.</p>
      <div className="actions">
        <button className="primary" onClick={() => setMode('paste')}>Paste a transcript</button>
        <button className="secondary" onClick={() => setMode('upload')}>Upload a recording</button>
      </div>
      {!canUpload && <p className="small muted" style={{ marginTop: 8 }}>Recordings need a transcription key (DEEPGRAM_API_KEY) in Render; pasting works now. Your iPhone's Voice Memos makes a transcript you can copy.</p>}
      {err && <div className="status err" role="alert">{err}</div>}
      {!rows && !err && <div style={{ marginTop: 16 }}><Pending text="Opening…" /></div>}
      {rows && !rows.length && <p className="empty-note" style={{ marginTop: 18 }}>No sessions yet.</p>}
      <div style={{ marginTop: 18 }}>
        {rows?.map((r) => (
          <button key={r.id} className="journal-entry pal-sage" onClick={() => go(`/hang/${r.id}`)}>
            <small>{when(r.created_at)}{r.minutes ? ` · ${Math.round(r.minutes)} min` : ''}{r.speakers ? ` · ${r.speakers} voices` : ''}</small>
            <strong>{r.title || 'Untitled session'}</strong>
            <span className="line1">{r.status === 'done' ? `${r.candidates} candidate${r.candidates === 1 ? '' : 's'}` : r.status === 'failed' ? `Didn't work: ${r.error?.message ?? ''}` : r.status === 'transcribing' ? 'Transcribing…' : 'Reading…'}</span>
          </button>
        ))}
      </div>

      {mode && (
        <Overlay title={mode === 'paste' ? 'Paste the transcript' : 'Upload the recording'} onClose={() => setMode(null)}>
          <label className="fld">Session (who, when)<input className="line" value={title} onChange={(e) => { setTitle(e.target.value); draftStore.set('hang:title', e.target.value); }} placeholder="e.g. Tuesday with M" /></label>
          {mode === 'paste' ? (
            <>
              <label className="fld">Transcript<textarea className="box" rows={10} value={text} onChange={(e) => { setText(e.target.value); draftStore.set('hang:text', e.target.value); }} placeholder="Paste the whole thing. Speaker names and times are kept if they're there." /></label>
              <p className="small muted">On an iPhone: Voice Memos → the recording → the transcript icon → Share → Copy.</p>
              <div className="actions" style={{ margin: '10px 0 8px' }}>
                <button className="secondary" onClick={() => setMode(null)}>Cancel</button>
                <button className="primary" disabled={text.trim().length < 40 || !!busy} onClick={paste}>{busy || 'Read it'}</button>
              </div>
            </>
          ) : (
            <>
              <input ref={file} type="file" accept="audio/*,.m4a,.mp3,.wav,.aac,.mp4" style={{ display: 'none' }} onChange={(e) => setPicked(e.target.files?.[0] ?? null)} />
              <div className="actions" style={{ margin: '4px 0 8px' }}><button className="secondary" onClick={() => file.current?.click()} disabled={!canUpload}>{picked ? picked.name : 'Choose a recording'}</button></div>
              {picked && <p className="small muted">{(picked.size / 1048576).toFixed(1)} MB. About {status?.transcriber?.usdPerMinute ? `${(status.transcriber.usdPerMinute * 60).toFixed(2)} dollars an hour` : ''} to transcribe, then a reading.</p>}
              {!canUpload && <p className="small muted">Add DEEPGRAM_API_KEY in Render to turn this on.</p>}
              <div className="actions" style={{ margin: '10px 0 8px' }}>
                <button className="secondary" onClick={() => setMode(null)}>Cancel</button>
                <button className="primary" disabled={!picked || !canUpload || !!busy} onClick={upload}>{busy || 'Upload and read'}</button>
              </div>
            </>
          )}
        </Overlay>
      )}
    </div>
  );
}

function HangDetail({ id }: { id: string }) {
  const { toast } = useApp();
  const [h, setH] = useState<HangRow | null>(null);
  const [err, setErr] = useState('');
  const [showDismissed, setShowDismissed] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const load = () => api<HangRow>('GET', `/hangs/${id}`).then((r) => { setH(r); setErr(''); return r; }).catch((e) => { setErr(e.message); return null; });
  useEffect(() => {
    let stop = false;
    (async () => {
      let r = await load();
      while (!stop && r && (r.status === 'transcribing' || r.status === 'extracting')) { await new Promise((x) => setTimeout(x, 3000)); r = await load(); }
    })();
    return () => { stop = true; };
  }, [id]);

  async function makeIdea(i: number) {
    setBusy(i);
    try { await api('POST', `/hangs/${id}/idea`, { index: i }); go('/write'); } catch (e) { toast((e as Error).message); }
    setBusy(null);
  }
  async function save(i: number) {
    setBusy(i);
    try { await api('POST', `/hangs/${id}/save`, { index: i }); toast('Saved to your journal.'); } catch (e) { toast((e as Error).message); }
    setBusy(null);
  }
  async function dismiss(i: number, undo = false) {
    try { setH(await api<HangRow>('POST', `/hangs/${id}/dismiss`, { index: i, undo })); } catch (e) { toast((e as Error).message); }
  }

  if (err) return <div className="status err" role="alert">{err}</div>;
  if (!h) return <Pending text="Opening…" />;
  const dismissed = new Set(h.dismissed);
  const shown = h.candidates.map((c, i) => ({ c, i })).filter(({ i }) => showDismissed || !dismissed.has(i));
  return (
    <div className="pal-sage">
      <div style={{ marginBottom: 6 }}><a className="tb under" style={{ paddingLeft: 0 }} href="#/hang">← Sessions</a></div>
      <div className="eyebrow">{when(h.created_at)}{h.minutes ? ` · ${Math.round(h.minutes)} min` : ''}{h.speakers ? ` · ${h.speakers} voices` : ''}</div>
      <h2 className="page-title">{h.title || 'Untitled session'}</h2>
      {h.status === 'transcribing' && <Pending text="Transcribing the recording… a few minutes for an hour of talk." />}
      {h.status === 'extracting' && <Pending text="Reading it for titles, concepts and lines…" />}
      {h.status === 'failed' && <div className="status err" role="alert">{h.error?.message ?? "That didn't work."}</div>}
      {h.status === 'done' && !h.candidates.length && <p className="empty-note">Nothing in this one stood out as a title or a line. That happens.</p>}
      {h.status === 'done' && KINDS.map(([k, label]) => {
        const items = shown.filter(({ c }) => c.kind === k);
        if (!items.length) return null;
        return (
          <section key={k} style={{ marginTop: 22 }}>
            <div className="eyebrow">{label}</div>
            {items.map(({ c, i }) => (
              <div key={i} className={`hang-card ${dismissed.has(i) ? 'is-dismissed' : ''}`}>
                <div className="hang-text">{c.text}</div>
                <div className="small muted">{[c.saidBy, c.at, c.why].filter(Boolean).join(' · ')}</div>
                {c.context && c.context !== c.text && <p className="hang-context">“{c.context}”</p>}
                <div className="hang-actions">
                  {dismissed.has(i)
                    ? <button className="tb under" onClick={() => dismiss(i, true)}>Bring back</button>
                    : <>
                      <button className="tb accent" disabled={busy === i} onClick={() => makeIdea(i)}>Make it an idea ↗</button>
                      <button className="tb" disabled={busy === i} onClick={() => save(i)}>Save</button>
                      <button className="tb" onClick={() => dismiss(i)} aria-label="Dismiss">×</button>
                    </>}
                </div>
              </div>
            ))}
          </section>
        );
      })}
      {h.status === 'done' && dismissed.size > 0 && <div style={{ marginTop: 14 }}><button className="tb under" style={{ paddingLeft: 0 }} onClick={() => setShowDismissed((v) => !v)}>{showDismissed ? 'Hide dismissed' : `Show ${dismissed.size} dismissed`}</button></div>}
      {h.status === 'done' && <p className="small muted" style={{ marginTop: 22 }}>The transcript was deleted after this reading. Only these candidates and the sentence around each are kept.</p>}
      <div className="actions" style={{ marginTop: 18 }}>
        <button className="secondary" onClick={async () => { if (confirm('Delete this session and its candidates?')) { await api('DELETE', `/hangs/${id}`); go('/hang'); } }}>Delete session</button>
      </div>
    </div>
  );
}
