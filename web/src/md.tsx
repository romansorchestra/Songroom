// A small, safe Markdown renderer for the chat's replies: paragraphs, headings, lists, bold,
// italics, inline code and fenced blocks. Fenced blocks are lyrics (the writer is told to put
// every lyric in one), so they render as a lyric sheet. An unclosed fence (a reply still
// streaming) is shown as a lyric sheet up to where it has got. React escapes all text.

import type { ReactNode } from 'react';

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'h'; level: number; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'lyric'; text: string; open: boolean };

export function blocks(src: string): Block[] {
  const out: Block[] = [];
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  let para: string[] = [];
  const flush = () => { if (para.length) { out.push({ kind: 'p', text: para.join('\n') }); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      flush();
      const body: string[] = [];
      let closed = false;
      for (i++; i < lines.length; i++) {
        if (/^\s*```\s*$/.test(lines[i])) { closed = true; break; }
        body.push(lines[i]);
      }
      out.push({ kind: 'lyric', text: body.join('\n').replace(/\s+$/, ''), open: !closed });
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flush(); out.push({ kind: 'h', level: h[1].length, text: h[2] }); continue; }
    const li = line.match(/^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/);
    if (li) {
      flush();
      const kind = li[1] ? 'ol' : 'ul';
      const last = out[out.length - 1];
      if (last && last.kind === kind) last.items.push(li[2]);
      else out.push({ kind, items: [li[2]] });
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    // a line continuing a list item (indented) stays with it
    const last = out[out.length - 1];
    if (!para.length && last && (last.kind === 'ul' || last.kind === 'ol') && /^\s{2,}\S/.test(line)) { last.items[last.items.length - 1] += ' ' + line.trim(); continue; }
    para.push(line);
  }
  flush();
  return out;
}

/** Bold, italics and inline code. */
export function inline(text: string, key = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
  let last = 0, n = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const t = m[0];
    // an underscore inside a word (snake_case) is not italics
    if (t.startsWith('_') && at > 0 && /\w/.test(text[at - 1])) { out.push(t); last = at + t.length; continue; }
    if (t.startsWith('**') || t.startsWith('__')) out.push(<strong key={`${key}${n++}`}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) out.push(<code key={`${key}${n++}`}>{t.slice(1, -1)}</code>);
    else out.push(<em key={`${key}${n++}`}>{t.slice(1, -1)}</em>);
    last = at + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** A lyric sheet: the title line (when it isn't a section label) and [Section] labels styled. */
export function LyricSheet({ text }: { text: string }) {
  const lines = text.split('\n');
  const first = lines[0]?.trim() ?? '';
  const hasTitle = !!first && !/^\[.*\]$/.test(first) && lines.length > 2 && (lines[1]?.trim() === '' || first === first.toUpperCase());
  return (
    <div className="lyric-sheet">
      {lines.map((l, i) => {
        if (i === 0 && hasTitle) return <div key={i} className="lyric-title">{l}</div>;
        if (/^\s*\[.*\]\s*$/.test(l)) return <div key={i} className="lyric-label">{l.trim().slice(1, -1)}</div>;
        if (!l.trim()) return <div key={i} className="lyric-gap" />;
        return <div key={i} className="lyric-line">{l}</div>;
      })}
    </div>
  );
}

export function Markdown({ text, lyricActions }: { text: string; lyricActions?: (lyric: string, index: number) => ReactNode }) {
  let lyricIndex = 0;
  return (
    <div className="md">
      {blocks(text).map((b, i) => {
        if (b.kind === 'p') return <p key={i}>{b.text.split('\n').flatMap((l, j) => (j ? [<br key={`b${j}`} />, ...inline(l, `${i}-${j}-`)] : inline(l, `${i}-${j}-`)))}</p>;
        if (b.kind === 'h') return <p key={i} className={`md-h md-h${b.level}`}>{inline(b.text, `${i}-`)}</p>;
        if (b.kind === 'ul') return <ul key={i}>{b.items.map((t, j) => <li key={j}>{inline(t, `${i}-${j}-`)}</li>)}</ul>;
        if (b.kind === 'ol') return <ol key={i}>{b.items.map((t, j) => <li key={j}>{inline(t, `${i}-${j}-`)}</li>)}</ol>;
        if (b.kind !== 'lyric') return null;
        const idx = lyricIndex++;
        return (
          <div key={i} className="lyric-block">
            <LyricSheet text={b.text} />
            {!b.open && lyricActions?.(b.text, idx)}
          </div>
        );
      })}
    </div>
  );
}
