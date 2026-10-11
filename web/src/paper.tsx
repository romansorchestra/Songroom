// Paper pieces from the approved design: title scraps, the taped seed scrap,
// handwritten fragments. Pure presentation over real, selectable text.

import { useEffect, useRef, type ReactNode } from 'react';

export type Palette = 'ochre' | 'sage' | 'blue';
export const palClass = (p?: string | null) => `pal-${p === 'sage' || p === 'blue' ? p : 'ochre'}`;

const BREAK_BEFORE = /^(when|while|if|and|but|or|so|then|like|to|from|for|with|without|on|in|at|of|the|your|my|our|their|his|her|is|are|was|were|you|i|we|they|that|this|before|after|until|till|since|because|cause|’cause)$/i;

/** Two natural phrase chunks when useful; never a mechanical half. One chunk for short titles. */
export function titleChunks(title: string, parts?: string[] | null): string[] {
  const t = title.trim();
  if (parts && parts.length && parts.join(' ').replace(/\s+/g, ' ') === t.replace(/\s+/g, ' ')) return parts.slice(0, 3);
  const words = t.split(/\s+/);
  if (words.length <= 2 || t.length <= 12) return [t];
  // Prefer a break before a function word nearest the middle; otherwise near the middle.
  const mid = words.length / 2;
  let best = -1, bestScore = Infinity;
  for (let i = 1; i < words.length; i++) {
    const score = Math.abs(i - mid) - (BREAK_BEFORE.test(words[i]) ? 1.2 : 0) + (i === words.length - 1 && words[i].length < 4 ? 1 : 0);
    if (score < bestScore) { bestScore = score; best = i; }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

export function TitleStrips({ title, parts, as = 'h1' }: { title: string; parts?: string[] | null; as?: 'h1' | 'h2' }) {
  const chunks = titleChunks(title || 'Untitled', parts);
  const H = as;
  return (
    <H className="idea-title">
      {chunks.map((c, i) => <span key={i} className={`title-strip ${i === chunks.length - 1 ? 'hl' : ''}`}>{c}</span>)}
    </H>
  );
}

export function Seed({ label, lines, children }: { label: string; lines: string[]; children?: ReactNode }) {
  return (
    <div className="seed">
      <div className="eyebrow">{label}</div>
      <p className="seed-lines">{lines.join('\n')}</p>
      {children}
    </div>
  );
}

export type Fragment = { id: string; text: string; saved: boolean; source?: string; ask?: string };

export function FragmentList({ items, onSave, onRemove, onAdd }: {
  items: Fragment[];
  onSave?: (f: Fragment) => void;
  onRemove?: (f: Fragment) => void;
  onAdd?: (f: Fragment) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="fragments">
      {items.map((f) => (
        <div className="fragment" key={f.id}>
          <p className={f.text.length > 90 || f.text.includes('\n\n') ? 'long' : ''}>{f.text}</p>
          {onAdd && <button className="tb" onClick={() => onAdd(f)} aria-label={`Add “${f.text.slice(0, 40)}” to lyrics`}>Add ↗</button>}
          {onSave && <button className="tb" onClick={() => onSave(f)} aria-label={f.saved ? 'Fragment saved' : 'Save fragment to Journal'} aria-pressed={f.saved}>{f.saved ? 'Saved ✓' : 'Save ↗'}</button>}
          {onRemove && <button className="tb" onClick={() => onRemove(f)} aria-label="Remove fragment">×</button>}
        </div>
      ))}
    </div>
  );
}

/** A composer that grows into multiple lines and keeps exactly what was typed. */
export function Composer({ value, onChange, onSubmit, placeholder, label, busy, submitLabel = 'Add', submitAria = 'Add fragment', inputRef }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; placeholder: string; label: string; busy?: boolean;
  submitLabel?: string; submitAria?: string; inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const own = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? own;
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`;
  }, [value, ref]);
  return (
    <form className="composer" onSubmit={(e) => { e.preventDefault(); if (value.trim() && !busy) onSubmit(); }}>
      <textarea ref={ref} rows={1} value={value} placeholder={placeholder} aria-label={label} autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (value.trim() && !busy) onSubmit(); } }} />
      <button className="tb" disabled={!value.trim() || busy} aria-label={submitAria}>{submitLabel}</button>
    </form>
  );
}

export function Pending({ text }: { text: string }) {
  return <span className="pending" role="status"><span className="dots" aria-hidden="true"><span /><span /><span /></span>{text}</span>;
}

export function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head"><span className="eyebrow">{title}</span><button className="tb" onClick={onClose} aria-label="Close">Close</button></div>
        {children}
      </div>
    </div>
  );
}
