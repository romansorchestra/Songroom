// Hard-constraint checks run in code on every candidate.
//
// Matching rule (documented, applied everywhere):
//   - Unicode NFC, case-insensitive, curly quotes treated as straight quotes.
//   - Start/end phrases ignore surrounding punctuation and whitespace.
//   - Forbidden words match whole words only, exact form ("leaving" does not ban "leave").

export type Constraints = {
  count: number | null;
  linesPerOption: number | null;
  mustStartWith: string | null;
  mustEndWith: string | null;
  forbidden: string[];
};

export type Check = { label: string; ok: boolean };

export const emptyConstraints = (): Constraints => ({
  count: null, linesPerOption: null, mustStartWith: null, mustEndWith: null, forbidden: [],
});

export function norm(s: string): string {
  return s.normalize('NFC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').toLowerCase();
}

function trimPunct(s: string): string {
  return s.replace(/^[\s"'.,;:!?…—–-]+|[\s"'.,;:!?…—–-]+$/g, '');
}

export function endsWithPhrase(text: string, phrase: string): boolean {
  const t = trimPunct(norm(text)), p = trimPunct(norm(phrase));
  if (!p) return true;
  return t === p || (t.endsWith(p) && /[^\p{L}\p{N}']$/u.test(t.slice(0, t.length - p.length)));
}

export function startsWithPhrase(text: string, phrase: string): boolean {
  const t = trimPunct(norm(text)), p = trimPunct(norm(phrase));
  if (!p) return true;
  return t === p || (t.startsWith(p) && /^[^\p{L}\p{N}']/u.test(t.slice(p.length)));
}

export function containsWord(text: string, word: string): boolean {
  const w = norm(word).trim();
  if (!w) return false;
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}'])${esc}(?![\\p{L}\\p{N}'])`, 'u').test(norm(text));
}

/** Deterministic extraction of the most common explicit constraints, merged with the writer's own reading. */
export function extractConstraints(request: string): Partial<Constraints> {
  const out: Partial<Constraints> = {};
  const q = `["“”‘’']`;
  const end = request.match(new RegExp(`(?:end(?:s|ing)?|land(?:s|ing)?|finish(?:es|ing)?)\\s+(?:on|with|in)\\s+(?:the\\s+(?:exact\\s+)?(?:words?|phrase)\\s+)?${q}([^"“”‘’]+?)${q}`, 'i'));
  if (end) out.mustEndWith = end[1].trim();
  const start = request.match(new RegExp(`(?:start(?:s|ing)?|begin(?:s|ning)?|open(?:s|ing)?)\\s+(?:on|with)\\s+${q}([^"“”‘’]+?)${q}`, 'i'));
  if (start) out.mustStartWith = start[1].trim();
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const count = request.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:distinct\s+|original\s+|alternative\s+|different\s+|strange\s+|more\s+|new\s+)*(?:\w+\s+)?(ideas?|concepts?|options?|alternatives?|titles?|couplets?|passages?|lines?|endings?|replacements?|versions?)\b/i);
  if (count) {
    const n = /\d/.test(count[1]) ? Number(count[1]) : words[count[1].toLowerCase()];
    if (n >= 1 && n <= 12) out.count = n;
  }
  return out;
}

export function mergeConstraints(model: Partial<Constraints> | null | undefined, det: Partial<Constraints>): Constraints {
  const base = emptyConstraints();
  const m = model ?? {};
  return {
    count: det.count ?? m.count ?? base.count,
    linesPerOption: m.linesPerOption ?? base.linesPerOption,
    mustStartWith: det.mustStartWith ?? m.mustStartWith ?? null,
    mustEndWith: det.mustEndWith ?? m.mustEndWith ?? null,
    forbidden: [...new Set([...(m.forbidden ?? []), ...(det.forbidden ?? [])].map((w) => w.trim()).filter(Boolean))],
  };
}

/** Checks for one candidate made of lines (an idea's seed lines, or a lines/edit option). */
export function checkCandidate(lines: string[], c: Constraints, opts: { checkEnds?: boolean; checkLineCount?: boolean } = {}): Check[] {
  const checks: Check[] = [];
  const nonEmpty = lines.filter((l) => l.trim() !== '');
  if (opts.checkLineCount && c.linesPerOption)
    checks.push({ label: `${c.linesPerOption} line${c.linesPerOption === 1 ? '' : 's'}`, ok: nonEmpty.length === c.linesPerOption });
  if (opts.checkEnds !== false) {
    if (c.mustEndWith) checks.push({ label: `ends “${c.mustEndWith}”`, ok: nonEmpty.length > 0 && endsWithPhrase(nonEmpty[nonEmpty.length - 1], c.mustEndWith) });
    if (c.mustStartWith) checks.push({ label: `starts “${c.mustStartWith}”`, ok: nonEmpty.length > 0 && startsWithPhrase(nonEmpty[0], c.mustStartWith) });
  }
  for (const w of c.forbidden) {
    const hit = lines.some((l) => containsWord(l, w));
    if (hit) checks.push({ label: `avoids “${w}”`, ok: false });
  }
  if (c.forbidden.length && !checks.some((x) => x.label.startsWith('avoids') && !x.ok))
    checks.push({ label: `avoids ${c.forbidden.map((w) => `“${w}”`).join(', ')}`, ok: true });
  return checks;
}
