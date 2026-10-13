// What Sam has told the writer, kept (11 Oct 2026). He asked, after an idea rhymed "call"
// with "hall" ("sounds like a wedding or church; hall shouldn't have been an option"):
// "Will it learn from me if I told it that?" Until now a note only reached the idea it was
// about, and "use for new ideas too" copied the whole sentence into the direction. Now each
// note he sends is boiled down, by the same call that reworks the idea, to one standing
// instruction, kept here and read by the writer on every idea, line and edit from then on.
// He can see the list in Settings and cross any out; he can also add one in his own words.

import type { Db } from '../db.js';
import { newId } from './lyrics.js';

export type LessonScope = 'standing' | 'session';
export type Lesson = { id: string; text: string; source: 'rework' | 'settings'; idea_id: string | null; note: string; created_at: string; scope: LessonScope; expires_at: string | null };
/** How long "this session" lasts: a note about the artist he's writing for today holds until tomorrow. */
export const SESSION_HOURS = 12;

export const LESSON_MAX_CHARS = 200;
/** How many reach the brief: the newest ones. The rest stay in Settings until he removes them. */
export const LESSONS_IN_BRIEF = 40;

const norm = (s: string) => s.toLowerCase().replace(/[“”"'‘’.,;:!?()]/g, '').replace(/\s+/g, ' ').trim();

/** The same instruction twice (word for word, or one inside the other) is one lesson. */
export function sameLesson(a: string, b: string): boolean {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

export class Lessons {
  constructor(private db: Db) {}

  /** The lessons in force now: every standing one, and session ones that haven't expired. Newest first. */
  async list(now = new Date()): Promise<Lesson[]> {
    return this.db.query<Lesson>(`SELECT id, text, source, idea_id, note, created_at, scope, expires_at FROM lessons WHERE expires_at IS NULL OR expires_at > $1 ORDER BY created_at DESC, rowid DESC`, [now.toISOString()]);
  }

  /** Keep one; returns null when the list already says it. */
  async add(textRaw: string, source: Lesson['source'], extra: { ideaId?: string | null; note?: string; scope?: LessonScope } = {}): Promise<Lesson | null> {
    const text = textRaw.replace(/\s+/g, ' ').trim().slice(0, LESSON_MAX_CHARS);
    if (text.length < 4) return null;
    const have = await this.list();
    if (have.some((l) => sameLesson(l.text, text))) return null;
    const id = newId('ls_');
    const scope: LessonScope = extra.scope === 'session' ? 'session' : 'standing';
    const expires = scope === 'session' ? new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString() : null;
    await this.db.query(`INSERT INTO lessons(id, text, source, idea_id, note, scope, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, text, source, extra.ideaId ?? null, (extra.note ?? '').trim().slice(0, 1000), scope, expires]);
    const [row] = await this.db.query<Lesson>(`SELECT id, text, source, idea_id, note, created_at, scope, expires_at FROM lessons WHERE id=$1`, [id]);
    return row;
  }

  async remove(id: string) { await this.db.query(`DELETE FROM lessons WHERE id=$1`, [id]); }

  async forIdea(ideaId: string): Promise<Lesson | null> {
    const [row] = await this.db.query<Lesson>(`SELECT id, text, source, idea_id, note, created_at, scope, expires_at FROM lessons WHERE idea_id=$1 ORDER BY created_at DESC LIMIT 1`, [ideaId]);
    return row ?? null;
  }

  /** The block the writer reads with every request; empty when he has said nothing yet. */
  async block(): Promise<string> {
    const rows = (await this.list()).slice(0, LESSONS_IN_BRIEF);
    return lessonsBlock(rows.filter((l) => l.scope !== 'session').map((l) => l.text), rows.filter((l) => l.scope === 'session').map((l) => l.text));
  }
}

export function lessonsBlock(standing: string[], session: string[] = []): string {
  const parts: string[] = [];
  if (standing.length) parts.push(`What Sam has told the writer, from his notes on earlier ideas. Standing instructions, newest first; they hold for every idea, line and edit unless today's request says otherwise. Apply each by avoiding the mistake it names; never build an idea around a lesson or echo its example:\n${standing.map((t) => `- ${t}`).join('\n')}`);
  if (session.length) parts.push(`What Sam has said about what he is writing today (the artist, the song, this session). It holds for today's ideas, not for ever:\n${session.map((t) => `- ${t}`).join('\n')}`);
  return parts.join('\n\n');
}
