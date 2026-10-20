// The research test (19 Oct 2026). Real briefs from his own sessions, each written twice: A and
// B. He picks the one he'd use, both, neither, or skips; a spark mark keeps an exceptional idea
// visible even when he picks the other side. A and B are fixed when the test is made and never
// move. Which side had research is shown only when every comparison has a verdict.

import { useEffect, useState } from 'react';
import { api } from './api';
import { Pending } from './paper';

type Check = { label: string; ok: boolean };
type Output =
  | { kind: 'ideas'; ideas: Array<{ title: string; concept: string; lines: string[] }>; checks: Check[]; note: string }
  | { kind: 'lines'; options: Array<{ lines: string[]; checks: Check[] }>; note: string }
  | { kind: 'replace'; options: Array<{ before: string; after: string; checks: Check[] }>; note: string }
  | { kind: 'titles'; titles: Array<{ title: string; lines: string[]; why: string }>; note: string }
  | { kind: 'draft'; sections: Array<{ label: string; lines: string[] }>; note: string }
  | { kind: 'reply'; text: string };
type Verdict = { pick: 'A' | 'B' | 'both' | 'neither' | 'skip'; spark: { A: boolean; B: boolean }; note: string; at: string };
type Trial = {
  id: string; n: number; route: string; shown: { label: string; context: string[] }; verdict: Verdict | null; seenAt: string | null;
  A: Output | null; B: Output | null; failed: boolean; reveal?: { A: 'on' | 'off'; B: 'on' | 'off'; cards: string[] };
};
type Batch = { id: string; name: string; done: boolean; trials: Trial[] };

function Out({ o }: { o: Output | null }) {
  if (!o) return <Pending text="Still being written…" />;
  if (o.kind === 'reply') return <p>{o.text}</p>;
  if (o.kind === 'ideas') return <>{o.ideas.map((i, k) => (
    <div className="trial-item" key={k}><div className="trial-title">{i.title}</div><div className="small">{i.concept}</div>{i.lines.map((l, j) => <p className="trial-line" key={j}>{l}</p>)}</div>
  ))}</>;
  if (o.kind === 'lines') return <>{o.options.map((x, k) => <div className="trial-item" key={k}><span className="trial-n">{k + 1}</span>{x.lines.map((l, j) => <p className="trial-line" key={j}>{l}</p>)}</div>)}</>;
  if (o.kind === 'replace') return <>{o.options.map((x, k) => <div className="trial-item" key={k}><span className="trial-n">{k + 1}</span><p className="trial-line">{x.after}</p></div>)}</>;
  if (o.kind === 'titles') return <>{o.titles.map((t, k) => <div className="trial-item" key={k}><div className="trial-title">{t.title}</div>{t.lines.map((l, j) => <p className="trial-line" key={j}>{l}</p>)}</div>)}</>;
  return <>{o.sections.map((sct, k) => <div className="trial-item" key={k}><div className="small muted">{sct.label}</div>{sct.lines.map((l, j) => <p className="trial-line" key={j}>{l}</p>)}</div>)}</>;
}

export function Trials({ id }: { id?: string }) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [list, setList] = useState<Array<{ id: string; name: string; n: number; judged: number }> | null>(null);
  const [at, setAt] = useState(0);
  const [spark, setSpark] = useState({ A: false, B: false });
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [tally, setTally] = useState<any | null>(null);
  const [err, setErr] = useState('');

  async function load(bid?: string) {
    try {
      const l = await api<Array<{ id: string; name: string; n: number; judged: number }>>('GET', '/trials');
      setList(l);
      const want = bid ?? id ?? l[0]?.id;
      if (!want) return;
      const b = await api<Batch>('GET', `/trials/${want}`);
      setBatch(b);
      if (b.done) setTally(await api('GET', `/trials/${want}/tally`).catch(() => null));
      return b;
    } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { void load().then((b) => { if (b) setAt(Math.max(0, b.trials.findIndex((t) => !t.verdict))); }); }, [id]);
  // keep checking while outputs are still being written
  useEffect(() => {
    if (!batch || batch.trials.every((t) => (t.A && t.B) || t.failed)) return;
    const h = setInterval(() => void load(batch.id), 4000);
    return () => clearInterval(h);
  }, [batch]);

  const t = batch?.trials[at];
  useEffect(() => {
    if (!t) return;
    setSpark(t.verdict?.spark ?? { A: false, B: false }); setNote(t.verdict?.note ?? ''); setNoteOpen(!!t.verdict?.note);
    if (!t.seenAt && t.A && t.B) void api('POST', `/trial/${t.id}/seen`).catch(() => {});
    window.scrollTo(0, 0);
  }, [t?.id, !!(t?.A && t?.B)]);

  async function vote(pick: Verdict['pick']) {
    if (!t || !batch) return;
    setErr('');
    try {
      const b = await api<Batch>('POST', `/trial/${t.id}/vote`, { pick, spark, note });
      setBatch(b);
      if (b.done) setTally(await api('GET', `/trials/${b.id}/tally`).catch(() => null));
      const next = b.trials.findIndex((x, i) => i > at && !x.verdict);
      const first = b.trials.findIndex((x) => !x.verdict);
      setAt(next >= 0 ? next : first >= 0 ? first : at);
    } catch (e) { setErr((e as Error).message); }
  }

  if (err && !batch) return <div className="status err" role="alert">{err}</div>;
  if (!list) return <Pending text="Loading…" />;
  if (!batch) return <div><h1 className="page-title">Research test</h1><p className="muted">No test yet.</p></div>;
  const judged = batch.trials.filter((x) => x.verdict).length;
  const ready = !!(t?.A && t?.B);

  return (
    <div className="trials">
      <div className="taste-top"><span className="eyebrow">Research test · {judged} of {batch.trials.length} judged</span><a className="tb under" href="#/settings/experiments">Done for now</a></div>
      <div className="taste-bar"><span style={{ width: `${(judged / batch.trials.length) * 100}%` }} /></div>
      <div className="chips" role="tablist" aria-label="Comparisons">
        {batch.trials.map((x, i) => (
          <button key={x.id} className={`chip${i === at ? ' on' : ''}`} aria-current={i === at ? 'true' : undefined} onClick={() => setAt(i)}>
            {x.n}{x.verdict ? (x.verdict.pick === 'skip' ? ' ·' : ' ✓') : ''}
          </button>
        ))}
      </div>
      {batch.done && tally && (
        <div className="panel" style={{ marginTop: 12 }}>
          <b>All {tally.n} judged.</b> Research on picked {tally.on}, research off picked {tally.off}, both {tally.both}, neither {tally.neither}{tally.skip ? `, skipped ${tally.skip}` : ''}. Sparks: on {tally.sparks.on}, off {tally.sparks.off}. Eight picks are a lean, not proof.
        </div>
      )}
      {t && <>
        <p className="eyebrow taste-ask" style={{ marginTop: 14 }}>{t.n}. {t.shown.label}</p>
        <div className="trial-brief">{t.shown.context.map((c, i) => <p key={i}>{c}</p>)}</div>
        {t.failed && <div className="status err">One version failed to write; skip this one.</div>}
        {(['A', 'B'] as const).map((side) => (
          <section key={side} className={`trial-sheet${t.verdict?.pick === side ? ' picked' : ''}`} aria-label={`Version ${side}`}>
            <div className="trial-side"><b>{side}</b>{t.reveal && <span className="small muted">{t.reveal[side] === 'on' ? `research on (${t.reveal.cards.join(', ') || 'no card'})` : 'research off'}</span>}</div>
            <Out o={t[side]} />
            <label className="trial-spark small"><input type="checkbox" checked={spark[side]} onChange={(e) => setSpark((s) => ({ ...s, [side]: e.target.checked }))} disabled={!ready} /> I'd use something here</label>
          </section>
        ))}
        <p className="small muted" style={{ marginTop: 10 }}>Which would you rather work from?</p>
        <div className="trial-picks">
          <button className="primary" disabled={!ready} onClick={() => vote('A')}>A</button>
          <button className="primary" disabled={!ready} onClick={() => vote('B')}>B</button>
          <button className="secondary" disabled={!ready} onClick={() => vote('both')}>Both good</button>
          <button className="secondary" disabled={!ready} onClick={() => vote('neither')}>Neither</button>
        </div>
        <div className="trial-under">
          {noteOpen
            ? <input className="line" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why (optional)" aria-label="Why (optional)" />
            : <button className="tb under" onClick={() => setNoteOpen(true)}>Add a reason (optional)</button>}
          <button className="tb under" onClick={() => vote('skip')}>Skip for now</button>
        </div>
        {t.verdict && <p className="small muted">Your answer: {t.verdict.pick === 'skip' ? 'skipped' : t.verdict.pick}. Pick again to change it.</p>}
        {err && <div className="status err" role="alert">{err}</div>}
      </>}
    </div>
  );
}
