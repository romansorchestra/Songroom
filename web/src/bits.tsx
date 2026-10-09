import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Check } from './api';

// Small hand-drawn margin doodles, one per page, chosen deterministically.
const DOODLES: ReactNode[] = [
  // coffee ring
  <g key="0"><circle cx="24" cy="24" r="16" /><path d="M10 28c4 6 14 10 24 4" opacity=".6" /><circle cx="24" cy="24" r="13" opacity=".35" /></g>,
  // crescent moon and a star
  <g key="1"><path d="M28 8a15 15 0 1 0 10 25A12 12 0 0 1 28 8z" /><path d="M38 10l1.5 3 3 1.5-3 1.5L38 19l-1.5-3-3-1.5 3-1.5z" /></g>,
  // small house with lit window
  <g key="2"><path d="M8 24L24 10l16 14" /><path d="M12 21v17h24V21" /><rect x="19" y="27" width="8" height="7" /><path d="M23 27v7M19 30.5h8" opacity=".6" /></g>,
  // key
  <g key="3"><circle cx="15" cy="24" r="7" /><path d="M22 24h20M36 24v6M41 24v4" /></g>,
  // bird on a wire
  <g key="4"><path d="M2 34c14-3 30-3 44 0" /><path d="M18 31c0-6 4-10 10-10 3 0 5 2 6 4l4 1-4 2c-1 4-5 6-10 6" /><circle cx="30" cy="24" r=".8" /></g>,
  // headlights / two circles and road
  <g key="5"><path d="M6 40L20 12M42 40L28 12" opacity=".6" /><circle cx="18" cy="30" r="4" /><circle cx="30" cy="30" r="4" /></g>,
  // paperclip
  <g key="6"><path d="M18 12v22a6 6 0 0 0 12 0V10a4 4 0 0 0-8 0v22a2 2 0 0 0 4 0V14" /></g>,
  // waves
  <g key="7"><path d="M4 18c5-4 9-4 14 0s9 4 14 0 9-4 14 0" /><path d="M4 27c5-4 9-4 14 0s9 4 14 0 9-4 14 0" opacity=".7" /><path d="M4 36c5-4 9-4 14 0s9 4 14 0 9-4 14 0" opacity=".45" /></g>,
];

export function Motif({ n }: { n: number }) {
  return (
    <svg className="motif" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {DOODLES[((n % DOODLES.length) + DOODLES.length) % DOODLES.length]}
    </svg>
  );
}

export function Checks({ checks }: { checks?: Check[] }) {
  if (!checks?.length) return null;
  return (
    <div className="checks">
      {checks.map((c, i) => (
        <span key={i} className={`chk ${c.ok ? 'ok' : 'no'}`}>{c.ok ? '✓' : '✗'} {c.label}</span>
      ))}
    </div>
  );
}

export function Menu({ label, items }: { label: string; items: Array<{ label: string; onClick: () => void } | null> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="menu" ref={ref}>
      <button className="btn ink sm" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><span aria-hidden="true" style={{ letterSpacing: 2, fontWeight: 600 }}>···</span></button>
      {open && (
        <div className="pop" role="menu">
          {items.filter(Boolean).map((it, i) => (
            <button key={i} role="menuitem" onClick={() => { setOpen(false); it!.onClick(); }}>{it!.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Thinking({ text = 'Writing', onCancel }: { text?: string; onCancel?: () => void }) {
  return (
    <div className="thinking" role="status">
      <span className="dots" aria-hidden="true"><span /><span /><span /></span>
      {text}
      {onCancel && <button className="linkbtn" onClick={onCancel}>Stop</button>}
    </div>
  );
}

export const Icon = {
  gear: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
  send: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>,
  unlock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2" /></svg>,
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
};

export function timeAgo(iso: string): string {
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}
