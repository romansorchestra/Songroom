import { useEffect, useState } from 'react';
import { api } from './api';
import { Checks, timeAgo } from './bits';
import { useApp } from './App';

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

export function Settings({ section }: { section?: string }) {
  const { status, refreshStatus, toast } = useApp();
  useEffect(() => { void refreshStatus(); }, [refreshStatus]);
  useEffect(() => { if (section) document.getElementById(section)?.scrollIntoView(); }, [section]);
  if (!status) return null;
  const s = status.settings;
  const set = async (patch: Record<string, unknown>) => {
    try { await api('PATCH', '/settings', patch); await refreshStatus(); toast('Saved'); } catch (e) { toast((e as Error).message); }
  };
  return (
    <div className="settings">
      <h1 style={{ fontSize: 30, marginBottom: 6 }}>Settings</h1>

      <section id="writer">
        <h2>Writer</h2>
        <p className="small muted">{status.writer.connected ? (status.writer.live ? 'Connected to the Anthropic API.' : 'Stand-in writer (placeholder text only).') : 'Not connected. Add ANTHROPIC_API_KEY in Render.'}</p>
        <div className="stack">
          <label className="field">Model
            <select value={s.model} onChange={(e) => void set({ model: e.target.value })}>
              {status.models.map((m) => <option key={m.id} value={m.id}>{m.label} ({m.note})</option>)}
            </select>
          </label>
          <div className="grid2">
            <label className="field">Thinking for ideas and drafts
              <select value={s.effortCreative} onChange={(e) => void set({ effortCreative: e.target.value })}>{EFFORTS.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <label className="field">Thinking for edits and Suno
              <select value={s.effortEdit} onChange={(e) => void set({ effortEdit: e.target.value })}>{EFFORTS.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
          </div>
          <p className="small muted">More thinking costs more and takes longer. It isn't proven to write better lyrics; judge by results.</p>
          <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!s.craftPack} onChange={(e) => void set({ craftPack: e.target.checked })} />
            <span>Use craft notes from the research pack</span>
          </label>
          <p className="small muted">Off until you've judged it in Experiments below. When on, the writer gets at most two short notes from working writers that fit the request, plus a reference profile when you name one it knows. Never the research itself.</p>
        </div>
      </section>

      <section id="spending"><Spending /></section>
      <section id="voice"><Voice taste={s.taste} onSaveTaste={(taste) => set({ taste })} /></section>
      <section id="experiments"><Experiments /></section>
      <section id="tests"><TestPack /></section>

      <section id="backup">
        <h2>Backup</h2>
        <p className="small muted">Everything you've written, every version, saved ideas and settings. Keys and passwords are never included.</p>
        <div className="row">
          <a className="btn quiet" href="/api/export.json" download>Download full backup</a>
          <a className="btn quiet" href="/api/export.md" download>Download journal as text</a>
        </div>
      </section>

      <section>
        <button className="btn quiet" onClick={async () => { await api('POST', '/logout'); location.reload(); }}>Sign out</button>
      </section>
    </div>
  );
}

function Spending() {
  const { status, refreshStatus, toast } = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [caps, setCaps] = useState({ d: '', m: '' });
  useEffect(() => { api('GET', '/receipts').then(setRows).catch(() => {}); }, []);
  useEffect(() => { if (status) setCaps({ d: String(status.spend.dailyCapUsd), m: String(status.spend.monthlyCapUsd) }); }, [status]);
  if (!status) return null;
  const sp = status.spend;
  const pct = (a: number, b: number) => `${Math.min(100, b ? (a / b) * 100 : 0)}%`;
  const save = async () => {
    try { await api('PATCH', '/settings', { dailyCapUsd: Number(caps.d), monthlyCapUsd: Number(caps.m) }); await refreshStatus(); toast('Caps saved'); } catch (e) { toast((e as Error).message); }
  };
  const label = (t: string) => ({ write: 'Writing', edit: 'Edit', suno: 'Suno' } as Record<string, string>)[t] ?? t;
  return (
    <>
      <h2>Spending</h2>
      <p className="small muted">The app's own count, from what Anthropic reports per request. Your Anthropic console is the real bill.</p>
      <div className="grid2">
        <div><div className="small">Today ${sp.today.toFixed(2)} of ${sp.dailyCapUsd.toFixed(2)}</div><div className="meter"><i style={{ width: pct(sp.today, sp.dailyCapUsd) }} /></div></div>
        <div><div className="small">This month ${sp.month.toFixed(2)} of ${sp.monthlyCapUsd.toFixed(2)}</div><div className="meter"><i style={{ width: pct(sp.month, sp.monthlyCapUsd) }} /></div></div>
      </div>
      <div className="grid2" style={{ marginTop: 12 }}>
        <label className="field">Daily cap ($)<input type="number" inputMode="decimal" min="0" value={caps.d} onChange={(e) => setCaps({ ...caps, d: e.target.value })} /></label>
        <label className="field">Monthly cap ($)<input type="number" inputMode="decimal" min="0" value={caps.m} onChange={(e) => setCaps({ ...caps, m: e.target.value })} /></label>
      </div>
      <div style={{ marginTop: 10 }}><button className="btn quiet sm" onClick={save}>Save caps</button></div>
      {!!rows.length && (
        <details style={{ marginTop: 14 }}>
          <summary className="small" style={{ cursor: 'pointer' }}>Recent requests</summary>
          <table className="table" style={{ marginTop: 8 }}>
            <thead><tr><th>When</th><th>What</th><th>Result</th><th className="num">Cost</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{timeAgo(r.created_at)}</td><td>{label(r.task)} <span className="muted">{r.effort}</span></td>
                  <td>{r.status === 'succeeded' ? 'OK' : r.status}</td>
                  <td className="num">{!r.live ? '–' : r.cost_usd != null ? `$${Number(r.cost_usd).toFixed(3)}` : r.reserved_usd ? `≤$${Number(r.reserved_usd).toFixed(2)}?` : '$0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </>
  );
}

function Voice({ taste, onSaveTaste }: { taste: string; onSaveTaste: (t: string) => void }) {
  const [t, setT] = useState(taste);
  const [list, setList] = useState<Array<{ id: string; direction: string; text: string }>>([]);
  const [adding, setAdding] = useState({ direction: '', text: '' });
  const [err, setErr] = useState('');
  const load = () => api('GET', '/voice').then(setList).catch(() => {});
  useEffect(() => { void load(); }, []);
  useEffect(() => setT(taste), [taste]);
  return (
    <>
      <h2>Your writing</h2>
      <p className="small muted">What the writer reads every time. Notes on your taste in your own words, and a few lyrics you're proud of so it hears your voice. It won't copy them.</p>
      <label className="field">Taste notes
        <textarea rows={5} placeholder={'e.g. Titles should be things people actually say.\nCountry: plain, specific, the turn comes late.\nNever “fire”, “shattered”, “wings”.'} value={t} onChange={(e) => setT(e.target.value)} />
      </label>
      <div style={{ marginTop: 8 }}><button className="btn quiet sm" disabled={t === taste} onClick={() => onSaveTaste(t)}>Save notes</button></div>
      <div className="stack" style={{ marginTop: 16 }}>
        {list.map((v) => (
          <details key={v.id}>
            <summary style={{ cursor: 'pointer' }}>{v.direction || 'Example'}: <span className="muted">{v.text.split('\n')[0].slice(0, 50)}</span></summary>
            <div className="code" style={{ marginTop: 6 }}>{v.text}</div>
            <button className="btn danger sm" style={{ marginTop: 6 }} onClick={async () => { await api('DELETE', `/voice/${v.id}`); await load(); }}>Remove</button>
          </details>
        ))}
        <input type="text" placeholder="Direction, e.g. country, confessional pop (optional)" value={adding.direction} onChange={(e) => setAdding({ ...adding, direction: e.target.value })} aria-label="Direction" />
        <textarea rows={5} placeholder="Paste a lyric you wrote" value={adding.text} onChange={(e) => setAdding({ ...adding, text: e.target.value })} aria-label="Lyric" />
        {err && <div className="error">{err}</div>}
        <div><button className="btn quiet sm" disabled={!adding.text.trim()} onClick={async () => {
          try { await api('POST', '/voice', adding); setAdding({ direction: '', text: '' }); setErr(''); await load(); } catch (e) { setErr((e as Error).message); }
        }}>Add example</button></div>
      </div>
    </>
  );
}

function TestPack() {
  const [data, setData] = useState<{ running: boolean; results: any[]; briefs: Array<{ id: string; label: string }> } | null>(null);
  const [err, setErr] = useState('');
  const load = () => api('GET', '/evals').then(setData).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!data?.running) return; const t = setInterval(load, 4000); return () => clearInterval(t); }, [data?.running]);
  const batches = [...new Set((data?.results ?? []).map((r) => r.batch))];
  const latest = batches[0];
  const shown = (data?.results ?? []).filter((r) => r.batch === latest).sort((a, b) => (a.brief_id < b.brief_id ? -1 : 1));
  return (
    <>
      <h2>Test pack</h2>
      <p className="small muted">Twelve fixed briefs (ideas, lines and precise edits) run through the real app. Use it to judge a model or setting change. A full run costs roughly $1–3.</p>
      <div className="row">
        <button className="btn quiet sm" disabled={data?.running} onClick={async () => { try { await api('POST', '/evals/run', { ids: [] }); await load(); } catch (e) { setErr((e as Error).message); } }}>{data?.running ? 'Running…' : 'Run all twelve'}</button>
      </div>
      {err && <div className="error">{err}</div>}
      {latest && <p className="small muted" style={{ marginTop: 10 }}>Latest run: {new Date(latest).toLocaleString()}</p>}
      <div className="stack" style={{ marginTop: 10 }}>
        {shown.map((r) => <EvalResult key={r.id} r={r} onVote={async (v) => { await api('POST', `/evals/${r.id}/vote`, { vote: v }); await load(); }} />)}
      </div>
    </>
  );
}

function EvalResult({ r, onVote }: { r: any; onVote: (v: string | null) => void }) {
  const x = r.result;
  const res = x.result ?? {};
  return (
    <details>
      <summary style={{ cursor: 'pointer' }}>{x.briefId} {x.label}: {x.status === 'succeeded' ? (r.vote ? `you said “${r.vote}”` : 'not judged') : x.status}{x.cost ? `, $${Number(x.cost).toFixed(3)}` : ''}</summary>
      <div className="stack" style={{ marginTop: 8 }}>
        <div className="small muted">{x.request}</div>
        {x.lyric && <div className="code">{x.lyric}</div>}
        {x.error && <div className="error">{x.error.message}</div>}
        {res.reply && <div className="reply">{res.reply}</div>}
        {(res.ideas ?? []).map((i: any, n: number) => (
          <article key={n} className="sheet"><h3 className="title">{i.title}</h3><p className="concept">{i.concept}</p><div className="lyrics">{i.lines.join('\n')}</div><Checks checks={i.checks} /></article>
        ))}
        {res.kind !== 'edit' && (res.options ?? []).map((o: any, n: number) => (
          <article key={n} className="sheet"><div className="lyrics">{o.lines.join('\n')}</div><Checks checks={o.checks} /></article>
        ))}
        {res.kind === 'edit' && (
          <>
            {res.note && <div className="small muted">{res.note}</div>}
            {res.options.map((o: any, n: number) => (
              <article key={n} className="sheet diff">
                {o.invalid ? <div className="error small">{o.invalid}</div> : o.diff.map((d: any) => <div key={d.lineId} className="pair lyric"><div className="before">{d.before}</div><div className="after">{d.after}</div></div>)}
                <Checks checks={o.checks} />
              </article>
            ))}
          </>
        )}
        <div className="small muted">Look for: {x.judge}</div>
        <div className="row">
          {['use', 'maybe', 'no'].map((v) => <button key={v} className={`btn sm ${r.vote === v ? '' : 'quiet'}`} onClick={() => onVote(r.vote === v ? null : v)}>{v === 'use' ? 'Would use' : v === 'maybe' ? 'Maybe' : 'No'}</button>)}
        </div>
      </div>
    </details>
  );
}

function Experiments() {
  const [data, setData] = useState<any | null>(null);
  const [tally, setTally] = useState<any | null>(null);
  const [err, setErr] = useState('');
  const [repeats, setRepeats] = useState(2);
  const load = () => Promise.all([api('GET', '/experiments').then(setData), api('GET', '/experiments/tally').then(setTally)]).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!data?.running) return; const t = setInterval(load, 5000); return () => clearInterval(t); }, [data?.running]);
  const batches = [...new Set((data?.trials ?? []).map((r: any) => String(r.batch)))] as string[];
  const latest: string | undefined = batches[0];
  const shown = (data?.trials ?? []).filter((r: any) => r.batch === latest).sort((a: any, b: any) => (a.repeat - b.repeat) || (a.briefId.localeCompare(b.briefId, undefined, { numeric: true })));
  const judged = shown.filter((r: any) => r.vote).length;
  const p = data?.progress;
  return (
    <>
      <h2>Experiments</h2>
      <p className="small muted">The same brief answered three ways: the old prompt, the corrected prompt, and the corrected prompt with research craft notes. The three answers are shuffled; which is which is shown only after you pick. Eleven fresh briefs × 2 repeats ≈ $2. Pick the one you'd use or develop; star anything exceptional.</p>
      <div className="row">
        <button className="btn quiet sm" disabled={data?.running} onClick={async () => { try { await api('POST', '/experiments/run', { ids: [], repeats }); await load(); } catch (e) { setErr((e as Error).message); } }}>{data?.running ? `Running… ${p?.done ?? 0}/${p?.total ?? 0}` : 'Run the comparison'}</button>
        <label className="small muted">repeats <select value={repeats} onChange={(e) => setRepeats(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        {p?.stopped && <span className="small error">{p.stopped}</span>}
      </div>
      {err && <div className="error">{err}</div>}
      {tally && tally.judged > 0 && (
        <div className="small" style={{ marginTop: 10 }}>
          <div>Judged so far: {tally.judged} (none: {tally.none}, tie: {tally.tie})</div>
          {(['A', 'B', 'C'] as const).map((c) => (
            <div key={c}>{data?.conditions?.[c]?.label ?? c}: <b>{tally.conditions[c].wins}</b> picked{tally.conditions[c].stars ? `, ${tally.conditions[c].stars} starred` : ''}{tally.conditions[c].costTotal ? `, $${tally.conditions[c].costTotal.toFixed(2)}` : ''}</div>
          ))}
          <div className="muted">A handful of picks is a lean, not proof.</div>
        </div>
      )}
      {latest && <p className="small muted" style={{ marginTop: 10 }}>Latest run: {new Date(latest).toLocaleString()} · {judged}/{shown.length} judged</p>}
      <div className="stack" style={{ marginTop: 10 }}>
        {shown.map((r: any) => <Trial key={r.id} r={r} onJudge={async (vote, stars) => { await api('POST', `/experiments/${r.id}/judge`, { vote, stars }); await load(); }} />)}
      </div>
    </>
  );
}

function Output({ res }: { res: any }) {
  if (!res) return <div className="muted small">No output.</div>;
  return (
    <div className="stack">
      {res.reply && <div className="reply small">{res.reply}</div>}
      {(res.ideas ?? []).map((i: any, n: number) => (
        <article key={n} className="sheet"><h3 className="title">{i.title}</h3>{i.concept && <p className="concept">{i.concept}</p>}<div className="lyrics">{i.lines.join('\n')}</div><Checks checks={i.checks} /></article>
      ))}
      {res.kind !== 'edit' && (res.options ?? []).map((o: any, n: number) => (
        <article key={n} className="sheet"><div className="lyrics">{o.lines.join('\n')}</div><Checks checks={o.checks} /></article>
      ))}
      {res.kind === 'edit' && (res.options ?? []).map((o: any, n: number) => (
        <article key={n} className="sheet diff">
          {o.invalid ? <div className="error small">{o.invalid}</div> : o.diff.map((d: any) => <div key={d.lineId} className="pair lyric"><div className="before">{d.before}</div><div className="after">{d.after}</div></div>)}
          <Checks checks={o.checks} />
        </article>
      ))}
      {res.draft && res.draft.sections.map((sec: any, n: number) => <article key={n} className="sheet"><div className="label">{sec.label}</div><div className="lyrics">{sec.lines.join('\n')}</div></article>)}
    </div>
  );
}

function Trial({ r, onJudge }: { r: any; onJudge: (vote: string | null, stars: number[]) => void }) {
  const [stars, setStars] = useState<number[]>(r.stars ?? []);
  useEffect(() => setStars(r.stars ?? []), [r.stars]);
  const done = r.positions.every((p: any) => p.status === 'succeeded');
  return (
    <details>
      <summary style={{ cursor: 'pointer' }}>{r.briefId} {r.label} (run {r.repeat}): {r.vote ? `you picked ${r.vote}` : done ? 'not judged' : 'incomplete'}</summary>
      <div className="stack" style={{ marginTop: 8 }}>
        {r.context && <div className="small muted">{r.context}</div>}
        {r.lyric && <div className="code">{r.lyric}</div>}
        <div className="small muted">{r.request}</div>
        {r.positions.map((p: any) => (
          <div key={p.position} style={{ borderTop: '1px solid var(--stone-2)', paddingTop: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>Option {p.position}</b>
              <span className="small muted">{p.conditionLabel ?? (r.vote ? '' : 'hidden until you pick')}{p.cost ? ` · $${Number(p.cost).toFixed(3)}` : ''}</span>
            </div>
            {p.error ? <div className="error small">{p.error.message}</div> : <Output res={p.result} />}
            <button className={`btn sm ${stars.includes(p.position) ? 'ink on' : 'ink'}`} style={{ marginTop: 6 }} onClick={() => { const next = stars.includes(p.position) ? stars.filter((x) => x !== p.position) : [...stars, p.position]; setStars(next); if (r.vote) onJudge(r.vote, next); }}>{stars.includes(p.position) ? '★ exceptional' : '☆ exceptional'}</button>
          </div>
        ))}
        <div className="row" style={{ borderTop: '1px solid var(--stone-2)', paddingTop: 10 }}>
          <span className="small muted">I'd use or develop:</span>
          {['1', '2', '3', 'tie', 'none'].map((v) => <button key={v} className={`btn sm ${r.vote === v ? '' : 'quiet'}`} onClick={() => onJudge(r.vote === v ? null : v, stars)}>{v === 'tie' ? 'Tie' : v === 'none' ? 'None' : v}</button>)}
        </div>
      </div>
    </details>
  );
}
