// What he changed, and to what (19 Oct 2026 commission, Phase D). Revisions are immutable, so
// every accepted edit is already on record; this reads them back as edits: the song and section,
// the lines before, the lines after, what he asked for (when a writer option was kept), and who
// wrote the new words. A writer's option he kept is evidence of preference, not authorship.
//
// Used in generation only when Settings → songHistory is on (default off), and only on the same
// song: these are his calls for this song, not rules for any other.

import type { Db } from './db.js';
import type { Section } from './engine/lyrics.js';

export type KeptEdit = {
  rev: number; at: string; source: string; section: string; before: string[]; after: string[];
  asked: string; by: 'sam' | 'writer-kept' | 'unclear';
};

/** Lines that differ between two versions of a section, as runs (longest common subsequence). */
export function changedRuns(a: string[], b: string[]): Array<{ before: string[]; after: string[] }> {
  const n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: Array<{ before: string[]; after: string[] }> = [];
  let i = 0, j = 0, cur: { before: string[]; after: string[] } | null = null;
  const flush = () => { if (cur && (cur.before.length || cur.after.length)) out.push(cur); cur = null; };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { flush(); i++; j++; continue; }
    cur ??= { before: [], after: [] };
    if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) cur.after.push(b[j++]);
    else cur.before.push(a[i++]);
  }
  flush();
  return out;
}

const EDIT_SOURCES = new Set(['typed', 'edit:writer', 'edit:direct']);

export async function keptEdits(db: Db, songId: string): Promise<KeptEdit[]> {
  const revs = await db.query<{ rev: number; sections: Section[]; source: string; note: string | null; created_at: string }>(
    `SELECT rev, sections, source, note, created_at FROM song_revisions WHERE song_id=$1 ORDER BY rev`, [songId]);
  const out: KeptEdit[] = [];
  for (let k = 1; k < revs.length; k++) {
    const prev = revs[k - 1], cur = revs[k];
    if (!EDIT_SOURCES.has(cur.source)) continue;
    // a "typed" save a fraction of a second after the song was made is the editor settling, not a decision he took
    const settling = cur.source === 'typed' && prev.source === 'created' && Date.parse(cur.created_at) - Date.parse(prev.created_at) < 2000;
    const by: KeptEdit['by'] = settling ? 'unclear' : cur.source === 'edit:writer' ? 'writer-kept' : 'sam';
    const count = Math.max(prev.sections.length, cur.sections.length);
    for (let s = 0; s < count; s++) {
      const a = prev.sections[s]?.lines.map((l) => l.text) ?? [];
      const b = cur.sections[s]?.lines.map((l) => l.text) ?? [];
      const label = cur.sections[s]?.label || prev.sections[s]?.label || `section ${s + 1}`;
      for (const r of changedRuns(a, b)) out.push({ rev: cur.rev, at: cur.created_at, source: cur.source, section: label, before: r.before, after: r.after, asked: cur.source === 'edit:writer' ? (cur.note ?? '') : '', by });
    }
  }
  return out;
}

/** At most three of his own recent changes to this song, for the writer. Empty when there are none. */
export function editsBlock(edits: KeptEdit[]): string {
  const mine = edits.filter((e) => e.by === 'sam' && e.before.length && e.after.length).slice(-3);
  if (!mine.length) return '';
  return 'Changes he made to this song himself (his calls for this song only, not rules for other songs):\n' +
    mine.map((e) => `- ${e.section}: "${e.before.join(' / ')}" → "${e.after.join(' / ')}"`).join('\n');
}
