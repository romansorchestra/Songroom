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
        </div>
      </section>

      <section id="spending"><Spending /></section>
      <section id="voice"><Voice taste={s.taste} onSaveTaste={(taste) => set({ taste })} /></section>
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
