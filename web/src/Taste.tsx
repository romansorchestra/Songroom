// The taste test (18 Oct 2026). Sam: "I don't love the way that I have to enter all that
// information on the settings. It's putting me off doing it. Can you design a more intuitive
// and clever way to test my taste and my level of judgment?"
//
// Three minutes, one card at a time, nothing to type. Pairs: tap the one you'd rather write.
// Choruses: tap the word that bugs you, or say it's fine (one weakness is planted in most).
// Then "Is this you?" over his Journal songs. Then what the writer heard, each finding with
// its evidence: Keep makes it a standing instruction. #/taste?preview=1 saves nothing.

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, clientKey, waitForRun } from './api';
import { Pending } from './paper';
import { go } from './App';
import { wordsOf, tapHits } from '../../shared/taste';

type Planted = { line: 0 | 1; text: string; flaw: string; note: string } | null;
type Card =
  | { id: string; kind: 'pair'; what: 'title' | 'chorus' | 'idea'; options: Array<{ side: 'a' | 'b'; text: string }>; repeat: boolean }
  | { id: string; kind: 'flaw'; lines: [string, string]; planted: Planted };
type Answer =
  | { card: string; kind: 'pair'; repeat?: boolean; pick: 'a' | 'b' | 'neither'; ms: number }
  | { card: string; kind: 'flaw'; tap: { line: 0 | 1; word: number } | null; why?: string; mind?: 'fair' | 'fine'; ms: number };
type Song = { id: string; title: string; text: string };
type Score = { pairs: number; neither: number; repeats: number; same: number; planted: number; caught: number; letThrough: number; otherWord: number; clean: number; cleanFine: number };
type Heard = { you: string; rule: string; basis: string };
type Saved = { session: string; cards: Card[]; songs: Song[]; why: string[]; i: number; answers: Answer[]; at: number };

const STORE = 'taste.session';
const MIN = 6;
const ASK: Record<string, string> = { title: 'Which title would you rather write?', chorus: 'Which chorus would you rather write?', idea: 'Which song would you rather write?' };
const load = (): Saved | null => { try { const s = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Saved | null; return s && Date.now() - s.at < 3 * 3600_000 ? s : null; } catch { return null; } };
const save = (s: Saved | null) => { try { s ? localStorage.setItem(STORE, JSON.stringify({ ...s, at: Date.now() })) : localStorage.removeItem(STORE); } catch { /* storage unavailable */ } };

export function Taste({ preview }: { preview: boolean }) {
  const [phase, setPhase] = useState<'intro' | 'cards' | 'songs' | 'reading' | 'heard' | 'done'>('intro');
  const [s, setS] = useState<Saved | null>(null);
  const [status, setStatus] = useState<{ sessions: number } | null>(null);
  const [err, setErr] = useState('');
  const resumable = useMemo(() => load(), []);

  useEffect(() => { api('GET', '/taste/status').then(setStatus).catch(() => {}); }, []);

  async function start(fresh: boolean) {
    setErr('');
    if (!fresh && resumable) { setS(resumable); if (resumable.i >= resumable.cards.length) finishCards(resumable); else setPhase('cards'); return; }
    try {
      const r = await api<{ cards: Card[]; songs: Song[]; why: string[] }>('GET', '/taste');
      const next: Saved = { session: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, cards: r.cards, songs: r.songs, why: r.why, i: 0, answers: [], at: Date.now() };
      setS(next); save(next); setPhase('cards'); window.scrollTo(0, 0);
    } catch (e) { setErr((e as Error).message); }
  }

  function answered(a: Answer) {
    if (!s) return;
    const next = { ...s, answers: [...s.answers, a], i: s.i + 1 };
    setS(next); save(next);
    if (next.i >= next.cards.length) finishCards(next);
  }
  function finishCards(cur: Saved) {
    if (cur.songs.length) { setPhase('songs'); window.scrollTo(0, 0); }
    else void read(cur, []);
  }

  // ---- reading ----
  const [score, setScore] = useState<Score | null>(null);
  const [heard, setHeard] = useState<{ runId: string; heard: Heard[]; note: string } | null>(null);
  const lastSongs = useRef<Array<{ id: string; mine: boolean }>>([]);
  async function read(cur: Saved, songs: Array<{ id: string; mine: boolean }>) {
    lastSongs.current = songs;
    setPhase('reading'); setErr(''); window.scrollTo(0, 0);
    try {
      const r = await api<{ runId: string; score: Score }>('POST', '/taste/read', { session: cur.session, preview, answers: cur.answers, songs, clientKey: clientKey() });
      setScore(r.score);
      save(null);
      const run = await waitForRun(r.runId);
      if (run.status !== 'succeeded') { setErr(run.error?.message ?? 'The reading didn’t come back. Your answers are kept.'); return; }
      setHeard({ runId: r.runId, heard: run.result.heard ?? [], note: run.result.note ?? '' });
      setPhase('heard');
    } catch (e) { setErr((e as Error).message); }
  }

  if (phase === 'intro') {
    return (
      <div className="pal-sage taste">
        <div className="topline"><a className="tb under" style={{ paddingLeft: 0 }} href="#/ideas">← Ideas</a>{preview && <span className="eyebrow">Preview · nothing saved</span>}</div>
        <h2 className="page-title">Your taste.</h2>
        <p className="concept">Three minutes, nothing to type. Tap the one you’d rather write, or the word that bugs you. At the end I’ll tell you what I heard, and you keep what’s true.</p>
        {resumable && <button className="primary big-new" onClick={() => start(false)}>Carry on ({resumable.i} of {resumable.cards.length} done)</button>}
        <button className={resumable ? 'secondary big-new' : 'primary big-new'} onClick={() => start(true)}>{resumable ? 'Start again' : 'Start'}</button>
        {!!status?.sessions && <p className="small muted">You’ve done it {status.sessions === 1 ? 'once' : `${status.sessions} times`}. It shows cards you haven’t seen first.</p>}
        {err && <div className="status err" role="alert">{err}</div>}
      </div>
    );
  }

  if (phase === 'cards' && s) {
    const card = s.cards[s.i];
    if (!card) return null;
    return (
      <div className="pal-sage taste">
        <div className="taste-top">
          <span className="small muted">{s.i + 1} of {s.cards.length}</span>
          {s.answers.length >= MIN && <button className="tb under" onClick={() => finishCards({ ...s, cards: s.cards.slice(0, s.i) })}>Stop here</button>}
        </div>
        <div className="taste-bar" aria-hidden="true"><span style={{ width: `${(s.i / s.cards.length) * 100}%` }} /></div>
        {card.kind === 'pair'
          ? <PairView key={`${card.id}${card.repeat ? 'r' : ''}`} card={card} onAnswer={answered} />
          : <FlawView key={card.id} card={card} why={s.why} onAnswer={answered} />}
      </div>
    );
  }

  if (phase === 'songs' && s) return <Songs songs={s.songs} preview={preview} onDone={(g) => read(s, g)} />;

  if (phase === 'reading') {
    return (
      <div className="pal-sage taste">
        <h2 className="page-title">Your taste.</h2>
        {score && <ScoreCard score={score} />}
        {!err ? <p><Pending text="Reading your answers…" /></p> : <div className="status err" role="alert">{err} {s && <button className="tb under" onClick={() => read(s, lastSongs.current)}>Try again</button>}<button className="tb under" onClick={() => go('/ideas')}>Back to Ideas</button></div>}
      </div>
    );
  }

  if ((phase === 'heard' || phase === 'done') && heard) {
    return <HeardView heard={heard} score={score} preview={preview} done={phase === 'done'} onKept={() => setPhase('done')} />;
  }
  return null;
}

/** Two options; tap one. "Neither" when both are below the bar. */
function PairView({ card, onAnswer }: { card: Extract<Card, { kind: 'pair' }>; onAnswer: (a: Answer) => void }) {
  const t0 = useRef(performance.now());
  const [picked, setPicked] = useState<string | null>(null);
  function pick(p: 'a' | 'b' | 'neither') {
    if (picked) return;
    setPicked(p);
    const ms = Math.round(performance.now() - t0.current);
    window.setTimeout(() => onAnswer({ card: card.id, kind: 'pair', repeat: card.repeat || undefined, pick: p, ms }), 260);
  }
  return (
    <>
      <div className="eyebrow taste-ask">{ASK[card.what]}</div>
      <div className="taste-pair">
        {card.options.map((o) => (
          <button key={o.side} className={`taste-option ${card.what} ${picked === o.side ? 'picked' : ''} ${picked && picked !== o.side ? 'faded' : ''}`} onClick={() => pick(o.side)}>
            <span>{o.text}</span>
          </button>
        ))}
      </div>
      <div className="taste-under"><button className="tb under" disabled={!!picked} onClick={() => pick('neither')}>Neither</button></div>
    </>
  );
}

/** A chorus: tap the word that bugs you, or "It's fine". Then a quick word on what happened. */
function FlawView({ card, why, onAnswer }: { card: Extract<Card, { kind: 'flaw' }>; why: string[]; onAnswer: (a: Answer) => void }) {
  const t0 = useRef(performance.now());
  const [tap, setTap] = useState<{ line: 0 | 1; word: number } | null>(null);
  const [ms, setMs] = useState(0);
  const [step, setStep] = useState<'read' | 'caught' | 'why' | 'reveal' | 'clean-fine' | 'yours'>('read');
  const [reason, setReason] = useState('');
  const p = card.planted;
  const auto = useRef(0);
  const sent = useRef(false);
  const done = (extra: Partial<Extract<Answer, { kind: 'flaw' }>> = {}) => {
    window.clearTimeout(auto.current);
    if (sent.current) return;
    sent.current = true;
    onAnswer({ card: card.id, kind: 'flaw', tap, ms, ...(reason ? { why: reason } : {}), ...extra });
  };
  useEffect(() => () => window.clearTimeout(auto.current), []);
  useEffect(() => {
    if (step === 'caught' || step === 'clean-fine' || step === 'yours') auto.current = window.setTimeout(() => done(), step === 'clean-fine' ? 1100 : 1500);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  function onWord(line: 0 | 1, word: number) {
    if (step !== 'read') return;
    setTap({ line, word }); setMs(Math.round(performance.now() - t0.current));
    setStep(p && p.line === line && tapHits(card.lines[line], word, p.text) ? 'caught' : 'why');
  }
  function fine() {
    if (step !== 'read') return;
    setMs(Math.round(performance.now() - t0.current));
    setStep(p ? 'reveal' : 'clean-fine');
  }
  const hit = (line: number, i: number) => !!p && step !== 'read' && step !== 'why' && p.line === line && tapHits(card.lines[line], i, p.text);
  return (
    <>
      <div className="eyebrow taste-ask">{step === 'read' ? 'Tap the word that bugs you' : step === 'why' ? 'What’s wrong with it?' : 'A chorus'}</div>
      <div className="taste-chorus">
        {card.lines.map((line, li) => (
          <p key={li}>
            {wordsOf(line).map((w, wi) => (
              <span key={wi}>{wi > 0 && ' '}<button className={`w ${tap && tap.line === li && tap.word === wi ? 'tapped' : ''} ${hit(li, wi) ? 'planted' : ''}`} disabled={step !== 'read'} onClick={() => onWord(li as 0 | 1, wi)}>{w.text}</button></span>
            ))}
          </p>
        ))}
      </div>
      {step === 'read' && <div className="taste-under"><button className="secondary" onClick={fine}>It’s fine</button></div>}
      {step === 'caught' && p && <p className="taste-verdict ok">✓ That’s the one I planted: {p.flaw}. <span className="muted">{p.note}</span> <button className="tb under" onClick={() => done()}>Next</button></p>}
      {step === 'clean-fine' && <p className="taste-verdict ok">✓ Nothing planted in that one. <button className="tb under" onClick={() => done()}>Next</button></p>}
      {step === 'why' && (
        <div className="chips">
          {why.map((w) => <button key={w} className="chip" onClick={() => { setReason(w); setStep(p ? 'reveal' : 'yours'); }}>{w}</button>)}
        </div>
      )}
      {step === 'yours' && <p className="taste-verdict">Nothing was planted there, so that one’s yours. <button className="tb under" onClick={() => done()}>Next</button></p>}
      {step === 'reveal' && p && (
        <>
          <p className="taste-verdict">{tap ? 'I’d planted something else: ' : 'I’d planted one: '}“{p.text}”, {p.flaw}. <span className="muted">{p.note}</span></p>
          <div className="actions">
            <button className="secondary" onClick={() => done({ mind: 'fair' })}>Fair, I missed it</button>
            <button className="secondary" onClick={() => done({ mind: 'fine' })}>I don’t mind it</button>
          </div>
        </>
      )}
    </>
  );
}

/** "Is this you?" Songs from his Journal; Mine teaches the writer his voice. */
function Songs({ songs, preview, onDone }: { songs: Song[]; preview: boolean; onDone: (g: Array<{ id: string; mine: boolean }>) => void }) {
  const [mine, setMine] = useState<Record<string, boolean>>({});
  return (
    <div className="pal-sage taste">
      <div className="eyebrow taste-ask">Is this you?</div>
      <p className="concept">Songs in your Journal. Tap Mine on the ones you wrote and the writer will learn your voice from them. It won’t copy them.{preview ? ' (Preview: nothing is saved.)' : ''}</p>
      {songs.map((g) => (
        <div key={g.id} className="title-card">
          <div className="title-card-title">{g.title || 'Untitled'}</div>
          <div className="title-card-lines">{g.text.split('\n').filter((l) => l.trim()).slice(0, 6).join('\n')}</div>
          <div className="actions" style={{ marginTop: 8 }}>
            <button className="secondary" aria-pressed={mine[g.id] === true} onClick={() => setMine({ ...mine, [g.id]: true })}>{mine[g.id] === true ? 'Mine ✓' : 'Mine'}</button>
            <button className="secondary" aria-pressed={mine[g.id] === false} onClick={() => setMine({ ...mine, [g.id]: false })}>{mine[g.id] === false ? 'Not mine ✓' : 'Not mine'}</button>
          </div>
        </div>
      ))}
      <button className="primary big-new" onClick={() => onDone(Object.entries(mine).map(([id, m]) => ({ id, mine: m })))}>Read my answers</button>
    </div>
  );
}

function ScoreCard({ score }: { score: Score }) {
  return (
    <div className="taste-score">
      {score.planted > 0 && <div><b>{score.caught} of {score.planted}</b><span>planted mistakes caught{score.otherWord ? `, and ${score.otherWord === 1 ? 'one' : score.otherWord} found of your own` : ''}</span></div>}
      {score.repeats > 0 && <div><b>{score.same} of {score.repeats}</b><span>same call when a pair came back</span></div>}
      {score.neither > 0 && <div><b>{score.neither}</b><span>{score.neither === 1 ? 'pair' : 'pairs'} where neither was good enough</span></div>}
    </div>
  );
}

function HeardView({ heard, score, preview, done, onKept }: { heard: { runId: string; heard: Heard[]; note: string }; score: Score | null; preview: boolean; done: boolean; onKept: (n: number) => void }) {
  const [choice, setChoice] = useState<Record<number, boolean>>({});
  const [keptN, setKeptN] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const kept = Object.entries(choice).filter(([, v]) => v).map(([k]) => Number(k));
  async function keep() {
    setBusy(true); setErr('');
    try { await api('POST', '/taste/keep', { runId: heard.runId, keep: kept }); setKeptN(kept.length); onKept(kept.length); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  return (
    <div className="pal-sage taste">
      <h2 className="page-title">Your taste.</h2>
      {score && <ScoreCard score={score} />}
      <div className="eyebrow taste-ask">What I heard</div>
      {!heard.heard.length && <p className="concept">Not enough to say anything yet. Another round would help.</p>}
      {heard.heard.map((h, i) => (
        <div key={i} className={`taste-heard ${choice[i] === true ? 'kept' : choice[i] === false ? 'dropped' : ''}`}>
          <p>{h.you}</p>
          <small className="muted">{h.basis}</small>
          {!done && (
            <div className="actions">
              <button className="secondary" aria-pressed={choice[i] === true} onClick={() => setChoice({ ...choice, [i]: true })}>{choice[i] === true ? 'Keep ✓' : 'Keep'}</button>
              <button className="secondary" aria-pressed={choice[i] === false} onClick={() => setChoice({ ...choice, [i]: false })}>Not me</button>
            </div>
          )}
        </div>
      ))}
      {heard.note && <p className="small muted">{heard.note}</p>}
      {!done
        ? <>
            {preview
              ? <><p className="small muted">Preview: nothing is kept.</p><button className="secondary big-new" onClick={() => go('/ideas')}>Back to Ideas</button></>
              : <button className="primary big-new" disabled={busy} onClick={keep}>{kept.length ? `Keep ${kept.length} for the writer` : heard.heard.length ? 'Keep none' : 'Done'}</button>}
            {err && <div className="status err" role="alert">{err}</div>}
          </>
        : <>
          <p className="taste-verdict ok">{keptN ? `Kept ${keptN === 1 ? 'one' : keptN}. The writer reads ${keptN === 1 ? 'it' : 'them'} with every idea, title and line from now on.` : 'Nothing kept. Come back for another round any time.'}</p>
          <div className="actions" style={{ marginTop: 6 }}>
            <button className="secondary" onClick={() => go('/ideas')}>Back to Ideas</button>
            <button className="secondary" onClick={() => go('/settings/lessons')}>See them in Settings</button>
          </div>
        </>}
    </div>
  );
}

