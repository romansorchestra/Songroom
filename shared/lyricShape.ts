// Shared by server and browser: how a lyric line is classified. Keep this free of
// Node or DOM imports. Both sides must agree exactly, or selections map to the
// wrong lines.

export const HEADER_RE =
  /^\s*[\[(]?\s*(intro|verse|pre[- ]?chorus|pre|chorus|post[- ]?chorus|hook|bridge|middle\s*8|outro|refrain|breakdown|interlude|tag|drop)\b[^\])]*[\])]?\s*:?\s*$/i;

export function isHeader(line: string): boolean {
  return HEADER_RE.test(line) && line.trim().length <= 40;
}

export function cleanHeader(line: string): string {
  return line.trim().replace(/^[\[(]\s*/, '').replace(/\s*[\])]\s*:?$/, '').replace(/:$/, '').trim();
}

/** Lyric lines of free text, in order: not blank, not a section header. */
export function lyricLinesOf(text: string): Array<{ index: number; text: string; start: number; end: number }> {
  const out: Array<{ index: number; text: string; start: number; end: number }> = [];
  let pos = 0, i = 0;
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.trim() !== '' && !isHeader(line)) out.push({ index: i++, text: line, start: pos, end: pos + line.length });
    pos += line.length + 1;
  }
  return out;
}
