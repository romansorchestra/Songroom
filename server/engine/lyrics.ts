// Lyric structure, stable line IDs and edits that cannot touch text outside their scope.
//
// Offsets convention: every `start`/`end` offset is a JavaScript string index
// (UTF-16 code units) into a single line's exact text. The client and server
// both use String.prototype.slice with these offsets. Nothing is normalised in
// stored text except that pasted "\r\n" / "\r" line endings become "\n".

import { randomBytes } from 'node:crypto';

export type Line = { id: string; text: string };
export type Section = { id: string; label: string; lines: Line[] };

export function newId(prefix: string): string {
  return prefix + randomBytes(6).toString('base64url');
}

const HEADER_RE =
  /^\s*[\[(]?\s*(intro|verse|pre[- ]?chorus|pre|chorus|post[- ]?chorus|hook|bridge|middle\s*8|outro|refrain|breakdown|interlude|tag|drop)\b[^\])]*[\])]?\s*:?\s*$/i;

export function isHeader(line: string): boolean {
  return HEADER_RE.test(line) && line.trim().length <= 40;
}

function cleanHeader(line: string): string {
  return line.trim().replace(/^[\[(]\s*/, '').replace(/\s*[\])]\s*:?$/, '').replace(/:$/, '').trim();
}

/** Parse pasted text into sections. Line text is preserved exactly (minus line-ending characters). */
export function parseLyrics(raw: string): Section[] {
  const text = raw.replace(/\r\n?/g, '\n');
  const sections: Section[] = [];
  let current: Section | null = null;
  const start = (label: string) => {
    current = { id: newId('s_'), label, lines: [] };
    sections.push(current);
  };
  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      if (current && (current as Section).lines.length > 0) current = null;
      continue;
    }
    if (isHeader(line)) {
      start(cleanHeader(line));
      continue;
    }
    if (!current) start('');
    (current as unknown as Section).lines.push({ id: newId('l_'), text: line });
  }
  return sections.filter((s) => s.lines.length > 0 || s.label !== '');
}

export function renderLyrics(sections: Section[], opts: { headers?: boolean } = {}): string {
  const headers = opts.headers ?? true;
  return sections
    .map((s) => {
      const body = s.lines.map((l) => l.text).join('\n');
      return headers && s.label ? `[${s.label}]\n${body}` : body;
    })
    .join('\n\n');
}

export function allLines(sections: Section[]): Line[] {
  return sections.flatMap((s) => s.lines);
}

export function findLine(sections: Section[], lineId: string): Line | undefined {
  for (const s of sections) for (const l of s.lines) if (l.id === lineId) return l;
  return undefined;
}

/**
 * Re-parse edited text while keeping line IDs for lines that survived.
 * Unchanged lines keep their IDs via longest-common-subsequence matching; a
 * changed line sitting where an old line was (same gap) inherits that ID.
 */
export function reparsePreservingIds(old: Section[], raw: string): Section[] {
  const fresh = parseLyrics(raw);
  const a = allLines(old);
  const b = allLines(fresh);
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i].text === b[j].text ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs: Array<[number, number]> = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i].text === b[j].text) { pairs.push([i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const used = new Set<string>();
  const assign = (bi: number, id: string) => { if (!used.has(id)) { b[bi].id = id; used.add(id); } };
  for (const [ai, bi] of pairs) assign(bi, a[ai].id);
  // gaps: pair unmatched old/new lines positionally
  let pa = 0, pb = 0;
  const bounds = [...pairs, [n, m] as [number, number]];
  for (const [ai, bi] of bounds) {
    const oldGap = a.slice(pa, ai), newGap = b.slice(pb, bi);
    for (let k = 0; k < Math.min(oldGap.length, newGap.length); k++) assign(pb + k, oldGap[k].id);
    pa = ai + 1; pb = bi + 1;
  }
  // keep section ids where labels line up
  fresh.forEach((s, idx) => {
    const match = old.find((o, oi) => o.label === s.label && (oi === idx || o.label !== ''));
    if (match && !fresh.some((f) => f !== s && f.id === match.id)) s.id = match.id;
  });
  return fresh;
}

// ---------- Targets and replacements ----------

/** An editable target: either a whole line or an exact span inside a line. */
export type Target =
  | { kind: 'line'; lineId: string; expected: string }
  | { kind: 'span'; lineId: string; start: number; end: number; expected: string };

export type Replacement = { lineId: string; newText: string };

export class EditError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export function resolveTargets(sections: Section[], targets: Target[], locked: Set<string>): Target[] {
  const seen = new Set<string>();
  for (const t of targets) {
    const line = findLine(sections, t.lineId);
    if (!line) throw new EditError('unknown_line', 'A selected line no longer exists.');
    if (locked.has(t.lineId)) throw new EditError('locked', 'That line is locked.');
    if (seen.has(t.lineId)) throw new EditError('duplicate_target', 'Select at most one span per line.');
    seen.add(t.lineId);
    if (t.kind === 'line') {
      if (line.text !== t.expected) throw new EditError('stale_selection', 'The line changed since you selected it.');
    } else {
      if (!(t.start >= 0 && t.end > t.start && t.end <= line.text.length))
        throw new EditError('bad_span', 'The selected words are out of range.');
      if (line.text.slice(t.start, t.end) !== t.expected)
        throw new EditError('stale_selection', 'The words changed since you selected them.');
    }
  }
  return targets;
}

/**
 * Turn a model's proposed text for each target into full-line replacements.
 * For a span target the server rebuilds the line as prefix + proposal + suffix,
 * so a provider can never alter surrounding words.
 */
export function buildReplacements(sections: Section[], targets: Target[], proposals: string[]): Replacement[] {
  if (proposals.length !== targets.length) throw new EditError('target_mismatch', 'Proposal does not cover every selection.');
  return targets.map((t, i) => {
    const line = findLine(sections, t.lineId)!;
    const proposal = proposals[i].replace(/\r\n?/g, '\n');
    if (proposal.includes('\n')) throw new EditError('multiline', 'A replacement may not add line breaks.');
    if (t.kind === 'line') return { lineId: t.lineId, newText: proposal };
    const pre = line.text.slice(0, t.start), suf = line.text.slice(t.end);
    // If the writer echoed the surrounding words, drop the echo rather than doubling them.
    let p = proposal;
    if (pre.trim().length > 2 && p.startsWith(pre)) p = p.slice(pre.length);
    if (suf.trim().length > 2 && p.endsWith(suf)) p = p.slice(0, p.length - suf.length);
    return { lineId: t.lineId, newText: pre + p + suf };
  });
}

/** Apply replacements to a copy. Only listed lines change; locked lines can never change. */
export function applyReplacements(sections: Section[], reps: Replacement[], locked: Set<string>): Section[] {
  const byId = new Map(reps.map((r) => [r.lineId, r.newText]));
  for (const r of reps) {
    if (locked.has(r.lineId)) throw new EditError('locked', 'That line is locked.');
    if (!findLine(sections, r.lineId)) throw new EditError('unknown_line', 'A line in this edit no longer exists.');
    if (r.newText.includes('\n')) throw new EditError('multiline', 'A replacement may not add line breaks.');
  }
  return sections.map((s) => ({
    ...s,
    lines: s.lines.map((l) => (byId.has(l.id) ? { ...l, text: byId.get(l.id)! } : { ...l })),
  }));
}

// ---------- Literal edits (no model needed) ----------

const CREATIVE_RE = /\b(options?|alternatives?|suggest\w*|ideas?|rhym\w*|give me|write|better|something|rework|improve|variations?)\b/i;

/** Parse "change X to Y" style instructions. Returns null when the request needs a writer. */
export function parseLiteral(instruction: string): { from: string; to: string } | null {
  const text = instruction.trim();
  if (CREATIVE_RE.test(text)) return null;
  const q = `["“”‘’']`;
  const patterns = [
    new RegExp(`(?:change|replace|swap)\\s+(?:only\\s+)?(?:the\\s+(?:final|last|first)\\s+word\\s+)?from\\s+${q}?(.+?)${q}?\\s+to\\s+${q}?(.+?)${q}?(?:[.;!]|$)`, 'i'),
    new RegExp(`(?:change|replace|swap)\\s+${q}(.+?)${q}\\s+(?:to|with|for)\\s+${q}(.+?)${q}`, 'i'),
    new RegExp(`(?:change|replace|swap)\\s+(\\S+(?:\\s+\\S+){0,3}?)\\s+(?:to|with)\\s+(\\S+(?:\\s+\\S+){0,5}?)(?:[.;!]|$)`, 'i'),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const from = m[1].trim().replace(/^["“‘']|["”’']$/g, '');
      const to = m[2].trim().replace(/^["“‘']|["”’']$/g, '');
      if (from && to && from !== to && !/\b(the|this|that)\s+(line|word|bit)\b/i.test(from)) return { from, to };
    }
  }
  return null;
}

function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * Apply a literal replacement within scope. Exact (case-sensitive) matches win;
 * if none exist, falls back to a case-insensitive whole-word match and keeps the
 * original's leading capital. Returns replacements only for lines that change.
 */
export function literalReplacements(
  sections: Section[], scope: Target[] | null, from: string, to: string, locked: Set<string>,
): Replacement[] {
  const lines = allLines(sections).filter((l) => !locked.has(l.id));
  const regions: Array<{ line: Line; start: number; end: number }> = scope && scope.length
    ? scope.map((t) => {
        const line = findLine(sections, t.lineId)!;
        return t.kind === 'span' ? { line, start: t.start, end: t.end } : { line, start: 0, end: line.text.length };
      })
    : lines.map((line) => ({ line, start: 0, end: line.text.length }));

  const run = (re: RegExp, keepCap: boolean): Replacement[] => {
    const out: Replacement[] = [];
    for (const { line, start, end } of regions) {
      const region = line.text.slice(start, end);
      let changed = false;
      const replaced = region.replace(re, (match) => {
        changed = true;
        if (keepCap && /^[A-Z]/.test(match) && /^[a-z]/.test(to)) return to[0].toUpperCase() + to.slice(1);
        return to;
      });
      if (changed) out.push({ lineId: line.id, newText: line.text.slice(0, start) + replaced + line.text.slice(end) });
    }
    return out;
  };
  const bounded = `(?<![\\p{L}\\p{N}'’])${escapeRe(from)}(?![\\p{L}\\p{N}'’])`;
  const exact = run(new RegExp(bounded, 'gu'), false);
  if (exact.length) return exact;
  return run(new RegExp(bounded, 'giu'), true);
}
