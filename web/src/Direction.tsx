// "Direction / reference": one optional, compact affordance. A reference is
// identified before it is used; a wrong match can be rejected and its traits
// are dropped with it. Unverified references are labelled as such.

import { useEffect, useState } from 'react';
import { api, clientKey } from './api';
import { Pending } from './paper';

export type Ref = {
  id: string; query: string; status: 'pending' | 'resolved' | 'ambiguous' | 'not_found' | 'unavailable' | 'text' | 'group'; name: string; identity: string; want: string;
  source: string; rejected: boolean;
  details: { characteristics?: string[]; sources?: Array<{ url: string; title: string }>; note?: string; text?: string; coverage?: string };
  candidates: Array<{ name: string; kind: string; identity: string }>;
  /** 19 Oct: several references typed at once ("Noah Kahan, Sam Fender"), one member each. */
  members?: Ref[];
};

/** A group's members, flattened (a looked-up part can itself be several). */
export function refMembers(r: Ref): Ref[] {
  return r.status === 'group' || r.members ? (r.members ?? []).flatMap((m) => (m.members ? refMembers(m) : [m])) : [r];
}

export function refSummary(r: Ref | null | undefined): string {
  if (!r || r.rejected) return '';
  if (r.members) return refMembers(r).map((m) => refSummary(m)).filter(Boolean).join(', ');
  if (r.status === 'resolved') return r.name;
  if (r.status === 'text') return 'pasted text';
  return `${r.query} (unverified)`;
}

/** One reference inside the card: what it was identified as, or an honest "couldn't". */
function RefBody({ r, onChoose }: { r: Ref; onChoose: (i: number) => void }) {
  return <>
    {r.status === 'pending' && <Pending text={`Looking up “${r.query}”…`} />}
    {r.status === 'resolved' && <>
      <div className="name">{r.name}</div>
      <div>{r.identity}</div>
      {!!r.details.characteristics?.length && <ul>{r.details.characteristics.slice(0, 4).map((c, i) => <li key={i}>{c}</li>)}</ul>}
      {r.details.coverage && <div className="small muted">These notes rest on: {r.details.coverage}</div>}
      <div className="small muted">From {r.source}.{r.details.sources?.length ? ' Sources: ' : ''}
        {r.details.sources?.slice(0, 3).map((s, i) => <span key={s.url}>{i ? ', ' : ''}<a href={s.url} target="_blank" rel="noreferrer">{s.title.slice(0, 40)}</a></span>)}
      </div>
    </>}
    {r.status === 'ambiguous' && <>
      <div>Which “{r.query}” do you mean?</div>
      {r.candidates.map((c, i) => (
        <button type="button" key={i} className="list-btn" onClick={() => onChoose(i)}><span className="t">{c.name}</span><small>{c.identity}</small></button>
      ))}
    </>}
    {(r.status === 'not_found' || r.status === 'unavailable') && <>
      <div><b>“{r.query}”</b>: couldn’t identify this{r.details.note ? `. ${r.details.note}` : '.'}</div>
      <div className="small muted">It will be used as an unverified name. Say what you like about it below so the writer works from that, not a guess.</div>
    </>}
    {r.status === 'text' && <div>Your pasted lines, used as a reference (not looked up).</div>}
  </>;
}

/** What he likes about one reference, saved on leaving the field. Optional. */
function WantField({ r, onSaved }: { r: Ref; onSaved: () => void }) {
  const [want, setWant] = useState(r.want ?? '');
  useEffect(() => { setWant(r.want ?? ''); }, [r.id]);
  async function save() { if (want === r.want) return; await api('PATCH', `/references/${r.id}`, { want }).catch(() => {}); onSaved(); }
  return (
    <label className="fld">What do you like about {r.status === 'resolved' ? r.name : 'it'}? (optional)
      <input className="line" value={want} onChange={(e) => setWant(e.target.value)} onBlur={save} placeholder="e.g. bratty asides, luxury brags, chantable hook" />
    </label>
  );
}

/** Look up and confirm one reference. Calls onChange with the confirmed (or unverified) ref, or null. */
export function RefChecker({ value, onChange }: { value: Ref | null; onChange: (r: Ref | null) => void }) {
  const [query, setQuery] = useState('');
  const [ref, setRef] = useState<Ref | null>(value);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [want, setWant] = useState(value?.want ?? '');
  useEffect(() => { setRef(value); setWant(value?.want ?? ''); }, [value?.id]);

  useEffect(() => {
    if (ref?.status !== 'pending') return;
    let stop = false;
    const tick = async () => {
      while (!stop) {
        await new Promise((r) => setTimeout(r, 1500));
        try { const r = await api<Ref>('GET', `/references/${ref.id}`); if (r.status !== 'pending') { if (!stop) { setRef(r); onChange(r); } return; } } catch { /* keep waiting */ }
      }
    };
    void tick();
    return () => { stop = true; };
  }, [ref?.id, ref?.status]);

  async function check() {
    if (busy) return;
    setErr(''); setBusy(true);
    try { const r = await api<Ref>('POST', '/references/resolve', { query, clientKey: clientKey() }); setRef(r); setQuery(''); if (r.status !== 'pending') onChange(r); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  async function reject() {
    if (!ref) return;
    await api('POST', `/references/${ref.id}/reject`).catch(() => {});
    setRef(null); onChange(null);
  }
  async function choose(i: number) {
    if (!ref) return;
    const r = await api<Ref>('POST', `/references/${ref.id}/choose`, { index: i }); setRef(r); onChange(r);
  }
  async function saveWant() {
    if (!ref || want === ref.want) return;
    const r = await api<Ref>('PATCH', `/references/${ref.id}`, { want }); setRef(r); onChange(r);
  }

  async function reload() {
    if (!ref) return;
    const r = await api<Ref>('GET', `/references/${ref.id}`).catch(() => null);
    if (r) { setRef(r); onChange(r); }
  }
  async function rejectMember(m: Ref) {
    await api('POST', `/references/${m.id}/reject`).catch(() => {});
    const left = ref ? refMembers(ref).filter((x) => x.id !== m.id) : [];
    if (!left.length) { await reject(); return; }
    await reload();
  }
  async function chooseMember(m: Ref, i: number) {
    await api<Ref>('POST', `/references/${m.id}/choose`, { index: i }).catch(() => {});
    await reload();
  }

  const group = !!ref?.members;
  return (
    <div>
      {(!ref || ref.rejected) && (
        <label className="fld">Reference: an artist, song, link, or paste a few lines
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="line" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. ADÉLA, Prima" aria-label="Reference" />
            <button type="button" className="secondary" style={{ flex: '0 0 auto' }} disabled={!query.trim() || busy} onClick={check}>{busy ? 'Checking…' : 'Check'}</button>
          </div>
        </label>
      )}
      {err && <div className="status err" role="alert">{err}</div>}
      {ref && !ref.rejected && !group && (
        <div className="ref-card" aria-live="polite">
          <RefBody r={ref} onChoose={choose} />
          {ref.status !== 'pending' && <>
            <label className="fld">What do you like about it? (optional)
              <input className="line" value={want} onChange={(e) => setWant(e.target.value)} onBlur={saveWant} placeholder="e.g. bratty asides, luxury brags, chantable hook" />
            </label>
            <button type="button" className="tb under" onClick={reject}>{ref.status === 'ambiguous' ? 'None of these' : 'Not this one'}</button>
          </>}
        </div>
      )}
      {ref && !ref.rejected && group && (
        <div aria-live="polite">
          {ref.status === 'pending' && !refMembers(ref).length && <Pending text={`Looking up “${ref.query}”…`} />}
          {refMembers(ref).map((m) => (
            <div className="ref-card" key={m.id}>
              <RefBody r={m} onChoose={(i) => chooseMember(m, i)} />
              {m.status !== 'pending' && <>
                <WantField r={m} onSaved={reload} />
                <button type="button" className="tb under" onClick={() => rejectMember(m)}>{m.status === 'ambiguous' ? 'None of these' : 'Not this one'}</button>
              </>}
            </div>
          ))}
          <button type="button" className="tb under" onClick={reject}>Clear all</button>
        </div>
      )}
    </div>
  );
}

/** Springboard direction: collapsed summary when set, a quiet link when not. Steers future ideas only. */
export function DirectionBox({ direction, reference, onSaved, startOpen = false }: {
  direction: { text: string; refId: string | null }; reference: Ref | null; onSaved: () => void; startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [text, setText] = useState(direction.text);
  const [ref, setRef] = useState<Ref | null>(reference);
  const [err, setErr] = useState('');
  useEffect(() => { setText(direction.text); setRef(reference); }, [direction.text, reference?.id]);
  const summary = [direction.text.trim(), refSummary(reference) && `ref: ${refSummary(reference)}`].filter(Boolean).join(' · ');

  async function save(next?: { text: string; refId: string | null }) {
    setErr('');
    try { await api('PUT', '/springboard/direction', next ?? { text, refId: ref && !ref.rejected ? ref.id : null }); setOpen(false); onSaved(); }
    catch (e) { setErr((e as Error).message); }
  }

  if (!open) {
    return (
      <div className="direction">
        {summary
          ? <div className="direction-summary"><span className="what">{summary}</span>
              <button className="tb under" onClick={() => setOpen(true)}>Edit</button>
              <button className="tb under" onClick={() => save({ text: '', refId: null })}>Clear</button></div>
          : <button className="tb under" style={{ paddingLeft: 0 }} onClick={() => setOpen(true)}>Direction / reference</button>}
      </div>
    );
  }
  return (
    <div className="panel">
      <label className="fld">Direction (optional)
        <textarea className="box" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. modern pop, sharp and conversational, female narrator" />
      </label>
      <RefChecker value={ref} onChange={setRef} />
      {err && <div className="status err" role="alert">{err}</div>}
      <div className="actions" style={{ margin: '10px 0 8px' }}>
        <button className="secondary" onClick={() => { setText(direction.text); setRef(reference); setOpen(false); }}>Cancel</button>
        <button className="primary" disabled={ref?.status === 'pending'} onClick={() => save()}>Use for new ideas</button>
      </div>
      <div className="small muted" style={{ paddingBottom: 6 }}>Steers the next ideas; the one on screen stays as it is.</div>
    </div>
  );
}
