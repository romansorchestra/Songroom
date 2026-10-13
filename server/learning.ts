// What the writer notices about what Sam keeps (12 Oct 2026). Sam, after a session: "I still
// feel like the concepts that it sends me are things I would never hear in songs… Can you
// somehow keep learning?" He types little; what he does says more. Every idea he sees ends
// one of a few ways: he makes a page of it, saves it, reworks it with a note, opens it from
// a list, leaves it in the list, or passes over it. After enough of those, the writer reads
// the last forty with their outcomes and writes down, for itself, what he goes for and what
// he passes on, with titles as evidence. That note is read with every brief after his own
// words (taste notes, lessons), which always outrank it. He can see it in Settings, make it
// learn again, or make it forget.

import type { Service } from './service.js';
import { reflectSchema, reflectZ } from './engine/schemas.js';
import { WriterError } from './engine/writer.js';

export type Outcome = { id: string; title: string; concept: string; line: string; direction: string; genre: string; what: string; strength: 'strong' | 'weak' };
export type Learned = { goesFor: string[]; passesOn: string[]; basis: number; at: string; runId: string | null; note?: string };

/** How many new outcomes between reflections. */
export const REFLECT_EVERY = 10;
const LOOK_BACK = 40;

export const REFLECT_SYSTEM = `You keep notes for yourself, as the co-writer in Songroom, on what Sam (a professional songwriter) actually keeps from the ideas you give him and what he passes over. You are writing instructions to yourself for the next ideas, not a description of Sam. Be concrete and modest: cite titles, prefer what he did (made a page, reworked with a note, opened from a list) over what he merely passed, and say nothing you can't point to. If the evidence only shows he was hunting one title that day, say that and little else.`;

export function reflectPrompt(outcomes: Outcome[], current: Learned | null): string {
  const lines = outcomes.map((o, i) => `${i + 1}. "${o.title}"${o.genre ? ` (${o.genre})` : ''} — ${o.concept}${o.line ? ` | first line: ${o.line}` : ''}${o.direction ? ` | his direction then: ${o.direction}` : ''}\n   → ${o.what}`);
  return [
    `The last ${outcomes.length} ideas Sam saw, oldest first, each with what he did:\n${lines.join('\n')}`,
    current ? `What you had noticed before (revise it; keep what still holds):\nHe goes for:\n${current.goesFor.map((b) => `- ${b}`).join('\n') || '- (nothing yet)'}\nHe passes on:\n${current.passesOn.map((b) => `- ${b}`).join('\n') || '- (nothing yet)'}` : '',
    `How to answer
- First separate two things. What he was chasing that day: a title or a story his direction named, and everything he did in its service (a rework asking for that song's image, a page for that song, notes about that song's artist). And what holds across songs: the scale of concept he keeps, the register, the kinds of detail, how titles work, what he never stops on. Only the second kind goes below. A note about one song's artist or one song's image is not a taste.
- "goesFor": up to five short instructions to yourself about what to write more of, each at most 25 words, each naming one or two titles as evidence, each one you would still trust on a different song. Only from strong signals (a page, a save, a rework note, opened from a list). Fewer is fine; none is fine. When nearly all the evidence is one chase, one or two instructions at most.
- "passesOn": up to four, same shape, about what to write less of. Passing over is weak evidence, so only name a pattern that shows across several ideas and more than one direction; never one idea alone. If he was chasing one title that day, passes on the others say nothing.
- Write about the writing, never facts about Sam as a person. No praise, no hedging words, no "it seems".
- "note": one short line: what he was chasing, if the day was mostly one chase; or empty.`,
  ].filter(Boolean).join('\n\n');
}

export function learnedBlock(l: Learned | null): string {
  if (!l || (!l.goesFor.length && !l.passesOn.length)) return '';
  return `What the writer has noticed about what Sam keeps and passes over, from his last ${l.basis} ideas. Weaker than his own words above; where they disagree, his words win:\n` +
    (l.goesFor.length ? `He goes for:\n${l.goesFor.map((b) => `- ${b}`).join('\n')}` : '') +
    (l.goesFor.length && l.passesOn.length ? '\n' : '') +
    (l.passesOn.length ? `He passes on:\n${l.passesOn.map((b) => `- ${b}`).join('\n')}` : '');
}

type IdeaRow = { id: string; title: string; concept: string; lines: Array<{ text: string }>; state: string; saved: number; song_id: string | null; batch_id: string | null; steer: { text?: string; genre?: string } | Record<string, never>; shown_at: string | null; created_at: string; parent_id: string | null; feedback: string };

export class Learning {
  constructor(private svc: Service) {}
  private get db() { return this.svc.db; }

  async current(): Promise<Learned | null> {
    const [row] = await this.db.query<{ value: Learned }>(`SELECT value FROM settings WHERE key='taste.learned'`);
    return row?.value ?? null;
  }

  async forget() { await this.db.query(`DELETE FROM settings WHERE key IN ('taste.learned', 'taste.learned.seen')`); }

  /** The last ideas he saw, oldest first, each with what he did about it. */
  async outcomes(limit = LOOK_BACK): Promise<Outcome[]> {
    const rows = await this.db.query<IdeaRow>(`SELECT id, title, concept, lines, state, saved, song_id, batch_id, steer, shown_at, created_at, parent_id, feedback FROM ideas WHERE origin='spark' AND state IN ('shown','listed') AND NOT archived ORDER BY created_at DESC, rowid DESC LIMIT $1`, [limit * 2]);
    const children = await this.db.query<{ parent_id: string; feedback: string }>(`SELECT parent_id, feedback FROM ideas WHERE parent_id IS NOT NULL`);
    const songs = new Set((await this.db.query<{ idea_id: string }>(`SELECT idea_id FROM songs WHERE idea_id IS NOT NULL AND NOT archived`)).map((s) => s.idea_id));
    const listRuns = new Set((await this.db.query<{ id: string }>(`SELECT id FROM runs WHERE task='list'`)).map((r) => r.id));
    const newest = rows[0]?.created_at ?? '';
    const out: Outcome[] = [];
    for (const r of rows) {
      const notes = children.filter((c) => c.parent_id === r.id).map((c) => c.feedback).filter(Boolean);
      const fromList = !!r.batch_id && listRuns.has(r.batch_id);
      let what = '', strength: Outcome['strength'] = 'weak';
      if (r.song_id || songs.has(r.id)) { what = 'made a page of it (started writing)'; strength = 'strong'; }
      else if (r.saved) { what = 'saved it to his journal'; strength = 'strong'; }
      else if (notes.length) { what = `reworked it with the note: ${notes.map((n) => `"${n}"`).join('; ')}`; strength = 'strong'; }
      else if (r.feedback && r.parent_id) { what = `this is a rework he asked for ("${r.feedback}"), then moved on from`; strength = 'weak'; }
      else if (fromList && r.state === 'shown') { what = 'picked it out of a list of ten to look at'; strength = 'strong'; }
      else if (r.state === 'listed') { what = 'left it in the list'; strength = 'weak'; }
      else if (r.created_at === newest) { what = 'the one on his screen now'; strength = 'weak'; }
      else { what = 'passed over it'; strength = 'weak'; }
      const steer = r.steer && 'text' in r.steer ? r.steer : {};
      out.push({ id: r.id, title: r.title, concept: r.concept.slice(0, 220), line: r.lines?.[0]?.text ?? '', direction: (steer.text ?? '').split('\n')[0].slice(0, 120), genre: steer.genre ?? '', what, strength });
      if (out.length >= limit) break;
    }
    return out.reverse();
  }

  /** Reflect when enough has happened since the last time; never more than one at once. */
  async maybeReflect(): Promise<string | null> {
    const [seenRow] = await this.db.query<{ value: number }>(`SELECT value FROM settings WHERE key='taste.learned.seen'`);
    const seen = Number(seenRow?.value ?? 0);
    const [{ n }] = await this.db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ideas WHERE origin='spark' AND state IN ('shown','listed') AND NOT archived`);
    if (Number(n) - seen < REFLECT_EVERY) return null;
    return this.reflect(null);
  }

  async reflect(clientKey: string | null): Promise<string | null> {
    if (!this.svc.writer) return null;
    const [running] = await this.db.query<{ id: string }>(`SELECT id FROM runs WHERE task='reflect' AND status='running' LIMIT 1`);
    if (running) return running.id;
    const outcomes = await this.outcomes();
    if (outcomes.length < 6) return null;
    const current = await this.current();
    const s = await this.svc.settings();
    const user = reflectPrompt(outcomes, current);
    const [{ n }] = await this.db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ideas WHERE origin='spark' AND state IN ('shown','listed') AND NOT archived`);
    const run = await this.svc.startRun({
      task: 'reflect', threadId: null, songId: null, clientKey, effort: s.effortEdit,
      promptVersion: 'reflect1', request: { outcomes: outcomes.length, strong: outcomes.filter((o) => o.strength === 'strong').length }, inputChars: REFLECT_SYSTEM.length + user.length,
      exec: async (signal, model) => {
        const r = await this.svc.call('reflect', REFLECT_SYSTEM, user, reflectSchema, s.effortEdit, signal, model);
        const parsed = reflectZ.safeParse(r.json);
        if (!parsed.success) throw new WriterError('bad_output', 'The writer returned an unexpected shape.', r.usage);
        return { result: parsed.data as unknown as Record<string, unknown>, usage: r.usage, requestId: r.requestId, model: r.model, live: r.live };
      },
      onSuccess: async (runId, result) => {
        const out = result as unknown as { goesFor: string[]; passesOn: string[]; note: string };
        const tidy = (xs: string[], max: number) => xs.map((x) => x.replace(/\s+/g, ' ').trim().slice(0, 220)).filter((x) => x.length > 3).slice(0, max);
        const learned: Learned = { goesFor: tidy(out.goesFor, 5), passesOn: tidy(out.passesOn, 4), basis: outcomes.length, at: new Date().toISOString(), runId, note: (out.note ?? '').trim().slice(0, 200) };
        await this.db.query(`INSERT INTO settings(key, value) VALUES ('taste.learned', $1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [JSON.stringify(learned)]);
        await this.db.query(`INSERT INTO settings(key, value) VALUES ('taste.learned.seen', $1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [JSON.stringify(Number(n))]);
      },
    });
    return run.id;
  }
}
