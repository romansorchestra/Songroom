// The taste test's word taps, shared by the server (scoring) and the browser (drawing the
// tappable words), so a tap means the same word on both sides.

export type Word = { text: string; start: number; end: number };

/** The words of a line, as tappable pieces: split on spaces, punctuation stays attached. */
export function wordsOf(line: string): Word[] {
  const out: Word[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}

/** Does word `index` of `line` fall inside the planted text (an exact substring of the line)? */
export function tapHits(line: string, index: number, planted: string): boolean {
  const w = wordsOf(line)[index];
  if (!w) return false;
  const at = line.indexOf(planted);
  if (at < 0) return false;
  return w.start < at + planted.length && w.end > at;
}

/** A tapped word without its punctuation, for showing back to him. */
export const bare = (s: string) => s.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');
