// Rhyme, checked by sound. Sam (11 Oct): "there's usually only 1 rhyme in the whole
// thing. Needs more attempts at clever rhyming." The writer is now asked to rhyme; this
// is how the engine checks that it did, from the CMU pronouncing dictionary rather than
// spelling. A pair is perfect when everything from the last stressed vowel matches,
// slant when the stressed vowels match and the endings are close. Multi-syllable
// (feminine / mosaic) rhymes are counted as "rich".

import { dictionary } from 'cmu-pronouncing-dictionary';

const dict = dictionary as Record<string, string>;

/** Phonemes of a word, or null when the dictionary doesn't have it. Tolerates "darlin'", "runnin". */
export function phones(wordRaw: string): string[] | null {
  const w = wordRaw.toLowerCase().replace(/[^a-z']/g, '');
  if (!w) return null;
  const tries = [w, w.replace(/'/g, ''), w.endsWith("in'") || w.endsWith('in') ? w.replace(/in'?$/, 'ing') : '', w.replace(/'s$/, '')].filter(Boolean);
  for (const t of tries) { const p = dict[t]; if (p) return p.split(' '); }
  return null;
}

const isVowel = (p: string) => /[AEIOU]/.test(p[0]) && /\d$/.test(p);
const stressed = (p: string) => /[12]$/.test(p);
const strip = (p: string) => p.replace(/\d$/, '');

/** Everything from the last stressed vowel: the part that has to match. */
export function rhymeTail(ph: string[]): { tail: string[]; syllables: number } | null {
  let i = ph.length - 1;
  while (i >= 0 && !(isVowel(ph[i]) && stressed(ph[i]))) i--;
  if (i < 0) { i = ph.findIndex(isVowel); if (i < 0) return null; }
  const tail = ph.slice(i).map(strip);
  return { tail, syllables: tail.filter((p) => /^[AEIOU]/.test(p)).length };
}

// consonants that sound alike at a line end (slant rhyme)
const CLOSE: Array<Set<string>> = [new Set(['T', 'D', 'TH', 'DH']), new Set(['S', 'Z']), new Set(['N', 'M', 'NG']), new Set(['F', 'V']), new Set(['K', 'G']), new Set(['P', 'B']), new Set(['SH', 'ZH', 'CH', 'JH'])];
const close = (a: string, b: string) => a === b || CLOSE.some((s) => s.has(a) && s.has(b));

export type RhymeKind = 'perfect' | 'slant' | 'none' | 'identical' | 'unknown';

/** How two end-words rhyme. Multi-word tails let "see her" rhyme with "fever" (mosaic rhyme). */
export function rhymeKind(aWords: string[], bWords: string[]): { kind: RhymeKind; rich: boolean } {
  const a = aWords.map(phones), b = bWords.map(phones);
  if (a.some((x) => !x) || b.some((x) => !x)) return { kind: 'unknown', rich: false };
  if (aWords.join(' ').toLowerCase() === bWords.join(' ').toLowerCase()) return { kind: 'identical', rich: false };
  const ta = rhymeTail(a.flat() as string[]), tb = rhymeTail(b.flat() as string[]);
  if (!ta || !tb) return { kind: 'unknown', rich: false };
  const rich = ta.syllables >= 2 && tb.syllables >= 2;
  if (ta.tail.join(' ') === tb.tail.join(' ')) {
    // "day" / "today": the same word repeated inside a longer one is not a rhyme
    const la = aWords.at(-1)!.toLowerCase(), lb = bWords.at(-1)!.toLowerCase();
    if (la.endsWith(lb) || lb.endsWith(la)) return { kind: 'identical', rich: false };
    return { kind: 'perfect', rich };
  }
  // slant: same stressed vowel, and the sounds after it close enough (mind/fine, home/alone, again/friend)
  if (ta.tail[0] === tb.tail[0]) {
    const ea = ta.tail.slice(1), eb = tb.tail.slice(1);
    if (!ea.length || !eb.length) return { kind: 'slant', rich: false };
    if (ea.length === eb.length && ea.every((p, i) => close(p, eb[i]))) return { kind: 'slant', rich };
    if (close(ea[0], eb[0]) || close(ea.at(-1)!, eb.at(-1)!)) return { kind: 'slant', rich };
  }
  return { kind: 'none', rich: false };
}

/** The last one or two words of a line, for end-rhyme. */
export function endWords(line: string, n = 2): string[] {
  const w = line.replace(/[(),.;:!?"“”…—–-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  return w.slice(-n);
}

export type RhymeReport = {
  pairs: Array<{ a: number; b: number; kind: RhymeKind; rich: boolean; words: [string, string] }>;
  score: number;        // rhymed line-ends, counting each line once
  rhymedLines: number;  // lines whose end rhymes with another line's end
  unknown: string[];    // end-words the dictionary doesn't know (not held against the writer)
};

/** End-rhymes among a block of lines: every pair of lines, best reading of the last one or two words. */
export function rhymeReport(lines: string[]): RhymeReport {
  const pairs: RhymeReport['pairs'] = [];
  const unknown = new Set<string>();
  const ends = lines.map((l) => endWords(l));
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      let best: { kind: RhymeKind; rich: boolean } = { kind: 'none', rich: false };
      for (const na of [1, 2]) for (const nb of [1, 2]) {
        const r = rhymeKind(ends[i].slice(-na), ends[j].slice(-nb));
        if (r.kind === 'unknown') { for (const w of [...ends[i].slice(-na), ...ends[j].slice(-nb)]) if (!phones(w)) unknown.add(w); continue; }
        if (rank(r.kind) > rank(best.kind) || (r.kind === best.kind && r.rich && !best.rich)) best = r;
      }
      if (best.kind === 'perfect' || best.kind === 'slant') pairs.push({ a: i, b: j, kind: best.kind, rich: best.rich, words: [ends[i].at(-1) ?? '', ends[j].at(-1) ?? ''] });
    }
  }
  const rhymed = new Set<number>(); for (const p of pairs) { rhymed.add(p.a); rhymed.add(p.b); }
  return { pairs, score: pairs.length, rhymedLines: rhymed.size, unknown: [...unknown] };
}
function rank(k: RhymeKind) { return k === 'perfect' ? 3 : k === 'slant' ? 2 : k === 'identical' ? 1 : 0; }

/** Sam's bar for a four-line block: at least two rhyme pairs, or every line rhymed with something. */
export function rhymesEnough(lines: string[]): boolean {
  const r = rhymeReport(lines);
  if (lines.length <= 2) return r.score >= 1;
  return r.score >= 2 || r.rhymedLines >= lines.length - 1 + (r.unknown.length ? -1 : 0);
}
