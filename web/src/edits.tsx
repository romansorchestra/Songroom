import { useState } from 'react';
import { api } from './api';
import { Checks } from './bits';

export type EditOption = { key: string; invalid?: string; replacements: Array<{ lineId: string; newText: string }>; diff: Array<{ lineId: string; before: string; after: string }>; checks: Array<{ label: string; ok: boolean }> };
export type EditPayload = { kind: 'edit'; direct: boolean; baseRev: number; instruction: string; reply?: string; note?: string; options: EditOption[] };

/** Suggested changes shown as before/after, each applied only on "Use this". */
export function EditOptions({ songId, p, runId, onApplied, toast }: { songId: string; p: EditPayload; runId: string | null; onApplied: () => void; toast: (s: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [used, setUsed] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const valid = p.options.filter((o) => !o.invalid);
  const discarded = p.options.length - valid.length;

  async function use(o: EditOption) {
    setBusy(o.key); setErr('');
    try {
      await api('POST', `/songs/${songId}/accept`, { baseRev: p.baseRev, replacements: o.replacements, source: p.direct ? 'direct' : 'writer', runId, note: p.instruction.slice(0, 280) });
      setUsed(o.key);
      toast('Changed. The previous version is in History.');
      onApplied();
    } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  }

  return (
    <div className="stack">
      {(p.note || p.reply) && <div className="small muted">{p.note || p.reply}</div>}
      {valid.map((o, i) => (
        <article key={o.key} className="sheet diff">
          {valid.length > 1 && <div className="label">Option {i + 1}</div>}
          {o.diff.map((d) => (
            <div key={d.lineId} className="pair lyric">
              {d.before !== d.after && <div className="before">{d.before}</div>}
              <div className="after">{d.after}</div>
            </div>
          ))}
          <Checks checks={o.checks} />
          <div className="actions">
            <button className={`btn ink sm ${used === o.key ? 'on' : ''}`} disabled={!!busy || !!used} onClick={() => void use(o)}>
              {used === o.key ? 'Used' : busy === o.key ? 'Applying…' : 'Use this'}
            </button>
          </div>
        </article>
      ))}
      {discarded > 0 && <div className="small muted">{discarded} suggestion{discarded === 1 ? '' : 's'} discarded for touching words you didn't select.</div>}
      {err && <div className="error" role="alert">{err}</div>}
    </div>
  );
}
