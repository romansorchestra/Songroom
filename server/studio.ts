// The approved design (10 Oct 2026): the idea springboard, fragments, the song
// workspace with one-suggestion-at-a-time proposals, the per-song working
// context, and reference identification. Built on Service; the writer's standing
// instructions are unchanged (systemCore), only output shapes are added here.

import type { Db } from './db.js';
import { Service, AppError, annotate, diffFor, motifFor, type PromptPlan } from './service.js';
import {
  type Section, type Target, type Replacement, newId, renderLyrics, allLines, findLine, resolveTargets,
  buildReplacements, parseLiteral, literalReplacements, insertLines, EditError,
} from './engine/lyrics.js';
import { extractConstraints, mergeConstraints, containsWord, endsWithPhrase, startsWithPhrase, syllables, endWord, type Check } from './engine/validate.js';
import { sparkSchema, sparkZ, reworkSchema, reworkZ, moreLinesSchema, moreLinesZ, suggestReplaceSchema, suggestReplaceZ, suggestAddSchema, suggestAddZ, referenceZ } from './engine/schemas.js';
import {
  systemCore, PROMPT_VERSION, WORKSPACE_TEMPLATE, IDEA_TEMPLATE, sparkPromptV2, reworkPrompt, moreLinesPrompt, suggestPrompt, contextBlock, referenceBlock,
  REFERENCE_SYSTEM, referencePrompt, type RefForPrompt, type WorkspaceContext,
} from './engine/prompts.js';
import { WriterError, type Usage } from './engine/writer.js';
import { SUBJECTS, GENRES, genreFor, pickSubjects, shapeNote } from './engine/barometer.js';

export const PALETTES = ['ochre', 'sage', 'blue'] as const;
export type Palette = (typeof PALETTES)[number];
const SPARK_BATCH = 3;
const SUGGEST_COUNT = 4;

type Direction = { text: string; refId: string | null; genre?: string };
type IdeaRow = {
  id: string; kind: string; title: string; concept: string; lines: Array<{ id: string; text: string }>; notes: string;
  starred: number; original: { title: string; concept: string; lines: string[] }; saved: number; origin: string; state: string;
  shown_at: string | null; palette: string | null; title_parts: string[] | null; steer: Direction | Record<string, never>;
  pending: string; note: string; song_id: string | null; archived: number; created_at: string; updated_at: string; saved_at: string | null;
};
type FragmentRow = { id: string; idea_id: string | null; song_id: string | null; text: string; saved: number; source: string; ask?: string; created_at: string; saved_at: string | null };
type StoredContext = {
  meaning?: string; meaningSource?: 'typed' | 'instruction';
  narrator?: string;
  rhyme?: { word: string; mode: 'fixed' | 'linked'; lineId?: string; notice?: { from: string; to: string } | null } | null;
  rhythm?: { sample: string } | null;
  refIds?: string[];
  lastInstruction?: string;
};
type RefRow = {
  id: string; query: string; norm: string; status: string; name: string; kind: string; identity: string; want: string;
  details: { characteristics?: string[]; sources?: Array<{ url: string; title: string }>; profileId?: string; text?: string; note?: string };
  candidates: Array<{ name: string; kind: string; identity: string; characteristics: string[] }>; source: string; rejected: number; run_id: string | null;
  created_at: string; updated_at: string;
};
type SetItem = { replacements?: Replacement[]; diff?: Array<{ lineId: string; before: string; after: string }>; lines?: string[]; checks: Check[]; direct?: boolean };
type SetRow = {
  id: string; song_id: string; run_id: string | null; base_rev: number; mode: 'replace' | 'add'; targets: { targets: Target[]; afterLineId: string | null };
  instruction: string; context: Record<string, unknown>; items: SetItem[] | null; status: string; error: { code: string; message: string } | null;
  parent_id: string | null; created_at: string;
};

export function normRef(q: string): string {
  return q.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// genre joins the key only when set, so directions saved before it existed keep their key
const stableDir = (d: Direction) => JSON.stringify(d.genre ? { text: d.text.trim(), refId: d.refId ?? null, genre: d.genre } : { text: d.text.trim(), refId: d.refId ?? null });

export class Studio {
  constructor(public svc: Service) {}
  get db(): Db { return this.svc.db; }

  // ------------------------------------------------------------------ keys
  private async kv<T>(key: string, fallback: T): Promise<T> {
    const [row] = await this.db.query<{ value: T }>(`SELECT value FROM settings WHERE key=$1`, [key]);
    return row ? row.value : fallback;
  }
  private async setKv(key: string, value: unknown) {
    await this.db.query(`INSERT INTO settings(key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [key, JSON.stringify(value)]);
  }
  /** Run an action at most once per client key; repeats return the first result. */
  private async once<T>(clientKey: string | null | undefined, fn: () => Promise<T>): Promise<T> {
    if (!clientKey) return fn();
    const [done] = await this.db.query<{ result: unknown }>(`SELECT result FROM client_actions WHERE key=$1`, [clientKey]);
    if (done) return (typeof done.result === 'string' ? JSON.parse(done.result) : done.result) as T;
    const out = await fn();
    await this.db.query(`INSERT INTO client_actions(key, result) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING`, [clientKey, JSON.stringify(out ?? null)]);
    return out;
  }

  // ------------------------------------------------------------ direction
  async direction(): Promise<Direction> {
    const d = await this.kv<Direction>('sb.direction', { text: '', refId: null });
    return { text: d.text ?? '', refId: d.refId ?? null, genre: d.genre ?? '' };
  }

  async setDirection(input: { text?: string; refId?: string | null; genre?: string }) {
    const cur = await this.direction();
    const genre = input.genre === undefined ? cur.genre ?? '' : input.genre;
    if (genre && !GENRES.some((g) => g.id === genre)) throw new AppError(400, 'bad_genre', 'Unknown genre.');
    const next: Direction = { text: (input.text ?? cur.text).slice(0, 2000), refId: input.refId === undefined ? cur.refId : input.refId, genre };
    if (next.refId) {
      const [r] = await this.db.query<{ id: string }>(`SELECT id FROM refs WHERE id=$1`, [next.refId]);
      if (!r) throw new AppError(404, 'not_found', 'Reference not found.');
    }
    await this.setKv('sb.direction', next);
    // Ideas queued for an older direction are never shown; they were not seen, so they're discarded.
    await this.db.query(`UPDATE ideas SET state='discarded' WHERE origin='spark' AND state='queued' AND steer<>$1`, [stableDir(next)]);
    return this.springboard();
  }

  // ----------------------------------------------------------- springboard
  async springboard() {
    const direction = await this.direction();
    const currentId = await this.kv<string | null>('sb.current', null);
    const current = currentId ? await this.idea(currentId).catch(() => null) : null;
    let prevId: string | null = null, nextId: string | null = null;
    if (current?.shown_at) {
      const [p] = await this.db.query<{ id: string }>(`SELECT id FROM ideas WHERE origin='spark' AND state='shown' AND NOT archived AND (shown_at < $1 OR (shown_at = $1 AND rowid < (SELECT rowid FROM ideas WHERE id=$2))) ORDER BY shown_at DESC, rowid DESC LIMIT 1`, [current.shown_at, current.id]);
      const [n] = await this.db.query<{ id: string }>(`SELECT id FROM ideas WHERE origin='spark' AND state='shown' AND NOT archived AND (shown_at > $1 OR (shown_at = $1 AND rowid > (SELECT rowid FROM ideas WHERE id=$2))) ORDER BY shown_at ASC, rowid ASC LIMIT 1`, [current.shown_at, current.id]);
      prevId = p?.id ?? null; nextId = n?.id ?? null;
    }
    const [running] = await this.db.query<{ id: string; error: unknown }>(`SELECT id, error FROM runs WHERE task='spark' AND status='running' ORDER BY created_at DESC LIMIT 1`);
    const [lastFail] = await this.db.query<{ id: string; status: string; error: { message?: string } | null; created_at: string }>(
      `SELECT id, status, error, created_at FROM runs WHERE task='spark' ORDER BY created_at DESC LIMIT 1`);
    const [{ n: queued }] = await this.db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ideas WHERE origin='spark' AND state='queued' AND steer=$1`, [stableDir(direction)]);
    let number = 0;
    if (current?.shown_at) [{ n: number }] = await this.db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ideas WHERE origin='spark' AND state='shown' AND NOT archived AND shown_at <= $1`, [current.shown_at]);
    return {
      direction, reference: direction.refId ? await this.ref(direction.refId).catch(() => null) : null,
      current, prevId, nextId, queued: Number(queued), number: Number(number),
      // a batch fetched ahead is not something he is waiting on; only show the spinner for one he asked for
      runId: running && (await this.kv<string | null>('sb.waiting', null)) === running.id ? running.id : null,
      prefetching: !!running,
      reworkRunId: (await this.db.query<{ id: string }>(`SELECT id FROM runs WHERE task='rework' AND status='running' ORDER BY created_at DESC LIMIT 1`))[0]?.id ?? null,
      lastError: lastFail && lastFail.status !== 'succeeded' && lastFail.status !== 'running' && (await this.kv<string | null>('sb.waiting', null)) === lastFail.id ? (lastFail.error?.message ?? 'That request failed.') : null,
      genres: GENRES,
      writer: { connected: !!this.svc.writer, live: !!this.svc.writer?.live },
    };
  }

  async idea(id: string) {
    const [row] = await this.db.query<IdeaRow>(`SELECT * FROM ideas WHERE id=$1`, [id]);
    if (!row) throw new AppError(404, 'not_found', 'Idea not found.');
    const fragments = await this.db.query<FragmentRow>(`SELECT id, idea_id, song_id, text, saved, source, ask, created_at, saved_at FROM fragments WHERE idea_id=$1 ORDER BY created_at, rowid`, [id]);
    let song: { id: string; title: string } | null = null;
    if (row.song_id) [song] = await this.db.query<{ id: string; title: string }>(`SELECT id, title FROM songs WHERE id=$1 AND NOT archived`, [row.song_id]);
    const legacySongs = await this.db.query<{ id: string; title: string }>(`SELECT id, title FROM songs WHERE idea_id=$1 AND NOT archived AND id<>COALESCE($2,'')`, [id, row.song_id]);
    const steer = (row.steer && 'text' in row.steer) ? row.steer as Direction : { text: '', refId: null };
    return {
      ...row, saved: !!row.saved, starred: !!row.starred, archived: !!row.archived,
      palette: (row.palette ?? PALETTES[motifFor(row.id) % 3]) as Palette,
      title_parts: row.title_parts && row.title_parts.join(' ').replace(/\s+/g, ' ').trim() === row.title.replace(/\s+/g, ' ').trim() ? row.title_parts : null,
      steer, fragments: fragments.map((f) => ({ ...f, saved: !!f.saved })),
      song: song ?? legacySongs[0] ?? null,
    };
  }

  async setCurrent(ideaId: string) {
    const [row] = await this.db.query<{ id: string; state: string }>(`SELECT id, state FROM ideas WHERE id=$1 AND origin='spark'`, [ideaId]);
    if (!row) throw new AppError(404, 'not_found', 'Idea not found.');
    if (row.state !== 'shown') await this.db.query(`UPDATE ideas SET state='shown', shown_at=$2 WHERE id=$1`, [ideaId, new Date().toISOString()]);
    await this.setKv('sb.current', ideaId);
    return this.springboard();
  }

  /** Show the next queued idea for this direction, or start generating a batch. */
  async sparkNext(clientKey: string | null) {
    const direction = await this.direction();
    const [q] = await this.db.query<{ id: string }>(`SELECT id FROM ideas WHERE origin='spark' AND state='queued' AND steer=$1 ORDER BY created_at, rowid LIMIT 1`, [stableDir(direction)]);
    if (q) {
      const shown = await this.setCurrent(q.id);
      // Ideas keep coming: when that was the last one waiting, the next batch starts now,
      // so the next tap has something ready. Never blocks or fails the tap.
      if (!shown.queued) await this.startBatch(null, false).catch(() => null);
      return { shown: true, ...shown };
    }
    if (clientKey) {
      const [r] = await this.db.query<{ id: string }>(`SELECT id FROM runs WHERE client_key=$1`, [clientKey]);
      if (r) return { shown: false, runId: r.id };
    }
    const runId = await this.startBatch(clientKey, true); // he is waiting on this one: show its first idea when it lands
    return { shown: false, runId };
  }

  /** Start one batch of ideas (or join the one already running). */
  private async startBatch(clientKey: string | null, waiting: boolean): Promise<string> {
    const direction = await this.direction();
    const [running] = await this.db.query<{ id: string }>(`SELECT id FROM runs WHERE task='spark' AND status='running' LIMIT 1`);
    if (running) { if (waiting) await this.setKv('sb.waiting', running.id); return running.id; }
    // marked before the run starts, so even a batch that lands at once knows he was waiting
    const marker = `pending:${newId('w_')}`;
    if (waiting) await this.setKv('sb.waiting', marker);
    if (!this.svc.writer) throw new AppError(503, 'no_writer', 'No writer is connected. Add the Anthropic API key in Render to generate ideas.');

    const s = await this.svc.settings();
    const plan: PromptPlan = { variant: PROMPT_VERSION, pack: s.craftPack === 'all' }; // ideas: only when notes are on for everything
    const refs = direction.refId ? await this.refsForPrompt([direction.refId]) : [];
    const recent = await this.db.query<{ title: string; subject: string | null }>(`SELECT title, subject FROM ideas WHERE origin='spark' AND state IN ('shown','queued') ORDER BY created_at DESC LIMIT 15`);
    const genre = genreFor(direction.genre, direction.text);
    const subjects = pickSubjects(genre, SPARK_BATCH, recent.slice(0, 3).map((r) => r.subject ?? '').filter(Boolean));
    const craft = this.svc.craftFor(plan, { text: direction.text || 'song ideas', reference: refs.map((r) => r.name).join(', ') || null, task: 'ideas' });
    const taste = await this.svc.tasteFor(direction.text);
    const system = systemCore(plan.variant) + (taste ? `\n\n${taste}` : '');
    const user = sparkPromptV2({
      direction: direction.text, genreLabel: GENRES.find((g) => g.id === genre)?.label ?? 'Pop', references: referenceBlock(refs),
      avoidTitles: recent.map((r) => r.title), subjects: subjects.map((k) => SUBJECTS[k]), shape: shapeNote(genre), craft: craft.block,
    });
    const prevCurrent = await this.kv<string | null>('sb.current', null);
    const steer = stableDir(direction);
    const run = await this.svc.startRun({
      task: 'spark', threadId: null, songId: null, clientKey, effort: s.effortCreative,
      promptVersion: `${plan.variant}${craft.record ? '+pack' : ''}/${IDEA_TEMPLATE}`,
      request: { direction, genre, subjects, prevCurrent, pack: craft.record }, inputChars: system.length + user.length,
      exec: async (signal, model) => {
        const r = await this.svc.call('spark', system, user, sparkSchema, s.effortCreative, signal, model);
        const parsed = sparkZ.safeParse(r.json);
        if (!parsed.success) throw new WriterError('bad_output', 'The writer returned an unexpected shape.', r.usage);
        return { result: parsed.data as unknown as Record<string, unknown>, usage: r.usage, requestId: r.requestId, model: r.model, live: r.live };
      },
      onSuccess: async (runId, result) => {
        const out = result as unknown as { ideas: Array<{ title: string; titleParts: string[]; concept: string; lines: string[] }>; note: string };
        const [{ n }] = await this.db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ideas WHERE origin='spark'`);
        const ids: string[] = [];
        let k = 0;
        for (const [j, i] of out.ideas.slice(0, SPARK_BATCH).entries()) {
          const lines = i.lines.map((t) => t.trim()).filter(Boolean).slice(0, 4);
          if (!i.title.trim() || !lines.length) continue;
          const id = newId('i_');
          const parts = i.titleParts.map((t) => t.trim()).filter(Boolean);
          await this.db.query(
            `INSERT INTO ideas(id, kind, title, concept, lines, original, source_run_id, motif, saved, origin, state, palette, title_parts, steer, note, batch_id, subject)
             VALUES ($1,'seed',$2,$3,$4,$5,$6,$7,0,'spark','queued',$8,$9,$10,$11,$6,$12)`,
            [id, i.title.trim().slice(0, 200), i.concept.trim().slice(0, 600), JSON.stringify(lines.map((t) => ({ id: newId('l_'), text: t }))),
              JSON.stringify({ title: i.title, concept: i.concept, lines }), runId, motifFor(id), PALETTES[(Number(n) + k) % 3],
              JSON.stringify(parts.length ? parts : null), steer, out.note.trim().slice(0, 300), subjects[j] ?? null],
          );
          ids.push(id); k++;
        }
        // A late batch never replaces an idea he moved to while it was being written,
        // and a batch fetched ahead waits in the queue for his next tap.
        const nowCurrent = await this.kv<string | null>('sb.current', null);
        const dirNow = stableDir(await this.direction());
        const w = await this.kv<string | null>('sb.waiting', null);
        const waited = waiting && (w === runId || w === marker);
        if (waited && ids.length && nowCurrent === prevCurrent && dirNow === steer) {
          await this.db.query(`UPDATE ideas SET state='shown', shown_at=$2 WHERE id=$1`, [ids[0], new Date().toISOString()]);
          await this.setKv('sb.current', ids[0]);
        }
        if (dirNow !== steer) await this.db.query(`UPDATE ideas SET state='discarded' WHERE batch_id=$1 AND state='queued'`, [runId]);
      },
    });
    if (waiting && (await this.kv<string | null>('sb.waiting', null)) === marker) await this.setKv('sb.waiting', run.id);
    return run.id;
  }

  /**
   * Rework the idea on screen to his note. What he marked to keep comes back word for
   * word (the engine puts it back if the writer drifts); the result becomes the idea on
   * screen, and Previous still reaches the one it came from.
   */
  async rework(ideaId: string, input: { feedback: string; keepTitle: boolean; keepConcept: boolean; keepLineIds: string[]; changeLineIds: string[]; applyToNew: boolean; clientKey: string | null }) {
    if (input.clientKey) {
      const [r] = await this.db.query<{ id: string }>(`SELECT id FROM runs WHERE client_key=$1`, [input.clientKey]);
      if (r) return { runId: r.id };
    }
    const [idea] = await this.db.query<IdeaRow & { subject: string | null }>(`SELECT * FROM ideas WHERE id=$1`, [ideaId]);
    if (!idea) throw new AppError(404, 'not_found', 'That idea no longer exists.');
    if (!input.feedback.trim() && !input.keepTitle && !input.keepConcept && !input.keepLineIds.length && !input.changeLineIds.length)
      throw new AppError(400, 'empty', 'Say what you think, or tap what to keep, first.');
    if (!this.svc.writer) throw new AppError(503, 'no_writer', 'No writer is connected.');
    if (input.applyToNew && input.feedback.trim()) {
      const d = await this.direction();
      const add = input.feedback.trim().replace(/\s+/g, ' ');
      if (!d.text.includes(add)) await this.setDirection({ text: [d.text.trim(), add].filter(Boolean).join('\n') });
    }
    const direction = await this.direction();
    const keepLines = idea.lines.filter((l) => input.keepLineIds.includes(l.id));
    const changeLines = idea.lines.filter((l) => input.changeLineIds.includes(l.id) && !input.keepLineIds.includes(l.id));
    const refs = direction.refId ? await this.refsForPrompt([direction.refId]) : [];
    const s = await this.svc.settings();
    const taste = await this.svc.tasteFor(direction.text);
    const system = systemCore(PROMPT_VERSION) + (taste ? `\n\n${taste}` : '');
    const user = reworkPrompt({
      idea: { title: idea.title, concept: idea.concept, lines: idea.lines.map((l) => l.text) },
      feedback: input.feedback, keepTitle: input.keepTitle, keepConcept: input.keepConcept,
      keepLines: keepLines.map((l) => l.text), changeLines: changeLines.map((l) => l.text),
      direction: direction.text, shape: shapeNote(genreFor(direction.genre, direction.text)), references: referenceBlock(refs),
    });
    const prevCurrent = await this.kv<string | null>('sb.current', null);
    const run = await this.svc.startRun({
      task: 'rework', threadId: null, songId: null, clientKey: input.clientKey, effort: s.effortCreative,
      promptVersion: `${PROMPT_VERSION}/${IDEA_TEMPLATE}`,
      request: { ideaId, feedback: input.feedback, keepTitle: input.keepTitle, keepConcept: input.keepConcept, keepLineIds: input.keepLineIds, changeLineIds: input.changeLineIds },
      inputChars: system.length + user.length,
      exec: async (signal, model) => {
        const r = await this.svc.call('rework', system, user, reworkSchema, s.effortCreative, signal, model);
        const parsed = reworkZ.safeParse(r.json);
        if (!parsed.success) throw new WriterError('bad_output', 'The writer returned an unexpected shape.', r.usage);
        return { result: parsed.data as unknown as Record<string, unknown>, usage: r.usage, requestId: r.requestId, model: r.model, live: r.live };
      },
      onSuccess: async (runId, result) => {
        const out = result as unknown as { title: string; titleParts: string[]; concept: string; lines: string[]; note: string };
        const title = input.keepTitle ? idea.title : out.title.trim().slice(0, 200) || idea.title;
        const concept = input.keepConcept ? idea.concept : out.concept.trim().slice(0, 600);
        let lines = out.lines.map((t) => t.trim()).filter(Boolean).slice(0, 4);
        // kept lines are his: every one comes back exactly, at its old place if the writer dropped it
        for (const k of keepLines) {
          if (lines.includes(k.text)) continue;
          const at = Math.min(idea.lines.findIndex((l) => l.id === k.id), lines.length);
          lines.splice(at < 0 ? lines.length : at, 0, k.text);
        }
        lines = lines.slice(0, Math.max(4, keepLines.length));
        let parts = out.titleParts.map((t) => t.trim()).filter(Boolean);
        if (input.keepTitle) parts = idea.title_parts ?? [];
        const id = newId('i_');
        const now = new Date().toISOString();
        await this.db.query(
          `INSERT INTO ideas(id, kind, title, concept, lines, original, source_run_id, motif, saved, origin, state, shown_at, palette, title_parts, steer, note, batch_id, subject, parent_id, feedback)
           VALUES ($1,'seed',$2,$3,$4,$5,$6,$7,0,'spark','shown',$8,$9,$10,$11,$12,$6,$13,$14,$15)`,
          [id, title, concept, JSON.stringify(lines.map((t) => ({ id: newId('l_'), text: t }))), JSON.stringify({ title: out.title, concept: out.concept, lines: out.lines }),
            runId, motifFor(id), now, idea.palette ?? PALETTES[0], JSON.stringify(parts.length ? parts : null), stableDir(direction), out.note.trim().slice(0, 300),
            idea.subject ?? null, idea.id, input.feedback.trim().slice(0, 1000)],
        );
        const nowCurrent = await this.kv<string | null>('sb.current', null);
        if (nowCurrent === prevCurrent) await this.setKv('sb.current', id);
      },
    });
    return { runId: run.id };
  }

  /** More lines for a song page, kept on the page as things he can tap into the draft. */
  async moreLines(songId: string, input: { ask: string; clientKey: string | null }) {
    if (input.clientKey) {
      const [r] = await this.db.query<{ id: string }>(`SELECT id FROM runs WHERE client_key=$1`, [input.clientKey]);
      if (r) return { runId: r.id };
    }
    if (!this.svc.writer) throw new AppError(503, 'no_writer', 'No writer is connected.');
    const ws = await this.workspace(songId);
    const s = await this.svc.settings();
    const onPage = [...(ws.idea?.lines.map((l) => l.text) ?? []), ...ws.scraps.map((f) => f.text)].slice(-40);
    const avoid = ws.scraps.filter((f) => f.source === 'writer').map((f) => f.text).slice(-30);
    const refs = await this.refsForPrompt(ws.context.refs.map((r) => r.id));
    const taste = await this.svc.tasteFor(input.ask);
    const system = systemCore(PROMPT_VERSION) + (taste ? `\n\n${taste}` : '');
    const user = moreLinesPrompt({
      title: String((ws as Record<string, unknown>).title ?? ''), concept: ws.idea?.concept ?? '', onPage, draft: renderLyrics(ws.sections),
      ask: input.ask, avoid, references: referenceBlock(refs),
    });
    const run = await this.svc.startRun({
      task: 'lines', threadId: null, songId, clientKey: input.clientKey, effort: s.effortCreative,
      promptVersion: `${PROMPT_VERSION}/${IDEA_TEMPLATE}`, request: { ask: input.ask }, inputChars: system.length + user.length,
      exec: async (signal, model) => {
        const r = await this.svc.call('lines', system, user, moreLinesSchema, s.effortCreative, signal, model);
        const parsed = moreLinesZ.safeParse(r.json);
        if (!parsed.success) throw new WriterError('bad_output', 'The writer returned an unexpected shape.', r.usage);
        return { result: parsed.data as unknown as Record<string, unknown>, usage: r.usage, requestId: r.requestId, model: r.model, live: r.live };
      },
      onSuccess: async (runId, result) => {
        const out = result as unknown as { lines: string[] };
        const seen = new Set(onPage.map((l) => l.trim().toLowerCase()));
        for (const [i, t] of out.lines.map((x) => x.trim()).filter(Boolean).slice(0, 8).entries()) {
          if (seen.has(t.toLowerCase())) continue;
          seen.add(t.toLowerCase());
          await this.db.query(`INSERT INTO fragments(id, song_id, text, saved, source, ask, client_key) VALUES ($1,$2,$3,0,'writer',$4,$5)`,
            [newId('f_'), songId, t.slice(0, 600), input.ask.trim().slice(0, 300), `lines:${runId}:${i}`]);
        }
      },
    });
    return { runId: run.id };
  }

  /** A starting point he types himself: his words become the idea's first thread, exactly. */
  async ownIdea(textRaw: string, clientKey: string | null) {
    return this.once(clientKey, async () => {
      const text = textRaw.replace(/\r\n?/g, '\n');
      const lines = text.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
      if (!lines.length) throw new AppError(400, 'empty', 'Type a line first.');
      const [{ n }] = await this.db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ideas WHERE origin='spark'`);
      const id = newId('i_');
      const title = lines[0].trim().slice(0, 120);
      const now = new Date().toISOString();
      await this.db.query(
        `INSERT INTO ideas(id, kind, title, concept, lines, original, motif, saved, origin, state, shown_at, palette, steer)
         VALUES ($1,'seed',$2,'',$3,$4,$5,0,'spark','shown',$6,$7,$8)`,
        [id, title, JSON.stringify(lines.map((t) => ({ id: newId('l_'), text: t }))), JSON.stringify({ title, concept: '', lines, typed: true }), motifFor(id), now,
          PALETTES[Number(n) % 3], stableDir(await this.direction())]);
      await this.setKv('sb.current', id);
      return { ideaId: id };
    });
  }

  async recent(limit = 40) {
    const ideas = await this.db.query<{ id: string; title: string; palette: string | null; saved: number; shown_at: string; song_id: string | null }>(
      `SELECT id, title, palette, saved, shown_at, song_id FROM ideas WHERE origin='spark' AND state='shown' AND NOT archived ORDER BY shown_at DESC, rowid DESC LIMIT $1`, [limit]);
    const sessions = await this.svc.threads(20);
    return { ideas: ideas.map((i) => ({ ...i, saved: !!i.saved })), sessions, retention: 'Kept until you delete them.' };
  }

  // ------------------------------------------------------------ ideas
  async patchIdea(id: string, patch: { pending?: string; saved?: boolean; title?: string; concept?: string; lines?: string[]; notes?: string; starred?: boolean; archived?: boolean }) {
    const [row] = await this.db.query<{ id: string; title: string; title_parts: string[] | null }>(`SELECT id, title, title_parts FROM ideas WHERE id=$1`, [id]);
    if (!row) throw new AppError(404, 'not_found', 'Idea not found.');
    if (patch.pending !== undefined) await this.db.query(`UPDATE ideas SET pending=$2 WHERE id=$1`, [id, patch.pending.slice(0, 20000)]);
    if (patch.saved === true) await this.db.query(`UPDATE ideas SET saved=1, saved_at=COALESCE(saved_at,$2), updated_at=$2 WHERE id=$1`, [id, new Date().toISOString()]);
    if (patch.saved === false) await this.db.query(`UPDATE ideas SET saved=0 WHERE id=$1`, [id]);
    const { pending: _p, saved: _s, ...content } = patch;
    if (Object.keys(content).length) {
      await this.svc.updateIdea(id, content);
      if (content.title !== undefined && content.title !== row.title) await this.db.query(`UPDATE ideas SET title_parts=NULL WHERE id=$1`, [id]);
    }
    return this.idea(id);
  }

  /** Create the linked song once; repeated taps open the same one. Source material stays out of the lyric. */
  async startWriting(ideaId: string) {
    const idea = await this.idea(ideaId);
    if (idea.song) return { songId: idea.song.id, created: false };
    const id = newId('g_');
    const context: StoredContext = { refIds: idea.steer.refId ? [idea.steer.refId] : [] };
    const created = await this.db.tx(async (q) => {
      const [again] = await q<{ song_id: string | null }>(`SELECT song_id FROM ideas WHERE id=$1`, [ideaId]);
      if (again?.song_id) {
        const [ok] = await q<{ id: string }>(`SELECT id FROM songs WHERE id=$1 AND NOT archived`, [again.song_id]);
        if (ok) return { songId: ok.id, created: false };
      }
      await q(`INSERT INTO songs(id, title, brief, idea_id, motif, kind, palette, context) VALUES ($1,$2,$3,$4,$5,'normal',$6,$7)`,
        [id, idea.title.slice(0, 200), idea.concept, ideaId, motifFor(id), idea.palette, JSON.stringify(context)]);
      await q(`INSERT INTO song_revisions(song_id, rev, sections, source, note) VALUES ($1,1,'[]','created',$2)`, [id, 'Started from an idea']);
      await q(`UPDATE ideas SET song_id=$2 WHERE id=$1`, [ideaId, id]);
      return { songId: id, created: true };
    });
    return created;
  }

  // ------------------------------------------------------------ fragments
  async addFragment(input: { ideaId?: string | null; songId?: string | null; text: string; clientKey?: string | null; source?: string }) {
    const text = input.text.replace(/\r\n?/g, '\n');
    if (!text.trim()) throw new AppError(400, 'empty', 'Type something first.');
    if (text.length > 20000) throw new AppError(400, 'too_long', 'That fragment is too long.');
    if (!input.ideaId && !input.songId) throw new AppError(400, 'no_parent', 'A fragment needs an idea or a song.');
    if (input.ideaId) { const [i] = await this.db.query(`SELECT id FROM ideas WHERE id=$1`, [input.ideaId]); if (!i) throw new AppError(404, 'not_found', 'Idea not found.'); }
    if (input.songId) { const [g] = await this.db.query(`SELECT id FROM songs WHERE id=$1`, [input.songId]); if (!g) throw new AppError(404, 'not_found', 'Song not found.'); }
    if (input.clientKey) {
      const [dup] = await this.db.query<FragmentRow>(`SELECT * FROM fragments WHERE client_key=$1`, [input.clientKey]);
      if (dup) return { ...dup, saved: !!dup.saved };
    }
    const id = newId('f_');
    await this.db.query(`INSERT INTO fragments(id, idea_id, song_id, text, source, client_key) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (client_key) DO NOTHING`,
      [id, input.ideaId ?? null, input.songId ?? null, text, input.source === 'suggestion' ? 'suggestion' : 'typed', input.clientKey ?? null]);
    const [row] = await this.db.query<FragmentRow>(`SELECT * FROM fragments WHERE ${input.clientKey ? 'client_key=$1' : 'id=$1'}`, [input.clientKey ?? id]);
    return { ...row, saved: !!row.saved };
  }

  async updateFragment(id: string, patch: { saved?: boolean; text?: string }) {
    const [row] = await this.db.query<FragmentRow>(`SELECT * FROM fragments WHERE id=$1`, [id]);
    if (!row) throw new AppError(404, 'not_found', 'Fragment not found.');
    const now = new Date().toISOString();
    if (patch.text !== undefined) {
      if (!patch.text.trim()) throw new AppError(400, 'empty', 'A fragment can’t be empty.');
      await this.db.query(`UPDATE fragments SET text=$2, updated_at=$3 WHERE id=$1`, [id, patch.text.replace(/\r\n?/g, '\n'), now]);
    }
    if (patch.saved === true) await this.db.query(`UPDATE fragments SET saved=1, saved_at=COALESCE(saved_at,$2), updated_at=$2 WHERE id=$1`, [id, now]);
    if (patch.saved === false) await this.db.query(`UPDATE fragments SET saved=0 WHERE id=$1`, [id]);
    const [out] = await this.db.query<FragmentRow>(`SELECT * FROM fragments WHERE id=$1`, [id]);
    return { ...out, saved: !!out.saved };
  }

  async deleteFragment(id: string) { await this.db.query(`DELETE FROM fragments WHERE id=$1`, [id]); }

  // ------------------------------------------------------------ journal
  async journal(q: string, filter: string) {
    const like = `%${q.trim().toLowerCase()}%`;
    const any = like === '%%';
    type Entry = { type: 'idea' | 'fragment' | 'song'; id: string; at: string; palette: Palette; title: string; text: string; parent?: { id: string; title: string } | null; legacy?: boolean; starred?: boolean };
    const out: Entry[] = [];
    if (filter === 'all' || filter === 'ideas') {
      const rows = await this.db.query<IdeaRow>(`SELECT * FROM ideas WHERE saved=1 AND kind='seed' AND NOT archived AND ($1 OR lower(title || ' ' || concept || ' ' || lines || ' ' || notes) LIKE $2) ORDER BY COALESCE(saved_at, updated_at) DESC LIMIT 300`, [any, like]);
      for (const r of rows) out.push({ type: 'idea', id: r.id, at: r.saved_at ?? r.updated_at, palette: (r.palette ?? 'ochre') as Palette, title: r.title, text: r.lines[0]?.text ?? r.concept, starred: !!r.starred });
    }
    if (filter === 'all' || filter === 'fragments') {
      const rows = await this.db.query<FragmentRow & { ititle: string | null; ipalette: string | null; stitle: string | null; spalette: string | null }>(
        `SELECT f.*, i.title AS ititle, i.palette AS ipalette, s.title AS stitle, s.palette AS spalette FROM fragments f
         LEFT JOIN ideas i ON i.id=f.idea_id LEFT JOIN songs s ON s.id=f.song_id
         WHERE f.saved=1 AND ($1 OR lower(f.text) LIKE $2) ORDER BY f.saved_at DESC LIMIT 300`, [any, like]);
      for (const r of rows) out.push({
        type: 'fragment', id: r.id, at: r.saved_at ?? r.created_at, palette: (r.ipalette ?? r.spalette ?? 'ochre') as Palette, title: '', text: r.text,
        parent: r.idea_id ? { id: r.idea_id, title: r.ititle ?? '' } : r.song_id ? { id: `song:${r.song_id}`, title: r.stitle ?? '' } : null,
      });
      const legacy = await this.db.query<IdeaRow>(`SELECT * FROM ideas WHERE saved=1 AND kind='line' AND NOT archived AND ($1 OR lower(title || ' ' || lines || ' ' || notes) LIKE $2) ORDER BY updated_at DESC LIMIT 300`, [any, like]);
      for (const r of legacy) out.push({ type: 'fragment', id: r.id, at: r.updated_at, palette: (r.palette ?? 'ochre') as Palette, title: '', text: r.lines.map((l) => l.text).join('\n'), legacy: true, starred: !!r.starred });
    }
    if (filter === 'all' || filter === 'songs') {
      const rows = await this.db.query<{ id: string; title: string; palette: string | null; motif: number; updated_at: string; sections: Section[]; ipalette: string | null; starred: number }>(
        `SELECT s.id, s.title, s.palette, s.motif, s.updated_at, s.starred, r.sections, i.palette AS ipalette FROM songs s
         JOIN song_revisions r ON r.song_id=s.id AND r.rev=s.current_rev LEFT JOIN ideas i ON i.id=s.idea_id
         WHERE NOT s.archived AND s.kind='normal' AND ($1 OR lower(s.title || ' ' || s.brief || ' ' || s.notes || ' ' || r.sections) LIKE $2)
         ORDER BY s.updated_at DESC LIMIT 300`, [any, like]);
      for (const r of rows) out.push({
        type: 'song', id: r.id, at: r.updated_at, palette: (r.palette ?? r.ipalette ?? PALETTES[r.motif % 3]) as Palette, title: r.title,
        text: allLines(r.sections).slice(0, 2).map((l) => l.text).join('\n'), starred: !!r.starred,
      });
    }
    out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    return { entries: out };
  }

  // ------------------------------------------------------------ references
  async ref(id: string): Promise<Omit<RefRow, 'rejected'> & { rejected: boolean }> {
    const [r] = await this.db.query<RefRow>(`SELECT * FROM refs WHERE id=$1`, [id]);
    if (!r) throw new AppError(404, 'not_found', 'Reference not found.');
    if (r.status === 'pending' && r.run_id) {
      const run = await this.svc.getRun(r.run_id);
      if (run.status !== 'running' && run.status !== 'succeeded') {
        await this.db.query(`UPDATE refs SET status='unavailable', details=$2, updated_at=$3 WHERE id=$1`,
          [id, JSON.stringify({ note: (run.error as { message?: string } | null)?.message ?? 'The lookup failed.' }), new Date().toISOString()]);
        return this.ref(id);
      }
    }
    return { ...r, rejected: !!r.rejected };
  }

  /** Identify a reference: research pack → earlier lookup → web search → an honest "couldn't check". */
  async resolveRef(queryRaw: string, clientKey: string | null) {
    const query = queryRaw.replace(/\r\n?/g, '\n').trim();
    if (!query) throw new AppError(400, 'empty', 'Type a reference first.');
    if (query.length > 8000) throw new AppError(400, 'too_long', 'That reference is too long; paste a verse or two.');
    const norm = normRef(query);
    const now = new Date().toISOString();
    const insert = async (fields: Partial<RefRow>) => {
      const id = newId('ref_');
      await this.db.query(`INSERT INTO refs(id, query, norm, status, name, kind, identity, details, candidates, source, run_id, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
        [id, query, norm, fields.status, fields.name ?? '', fields.kind ?? '', fields.identity ?? '', JSON.stringify(fields.details ?? {}), JSON.stringify(fields.candidates ?? []), fields.source ?? '', fields.run_id ?? null, now]);
      return this.ref(id);
    };
    // Pasted lyrics or notes: his own material to point at, never looked up.
    if (query.includes('\n') || query.length > 160) return insert({ status: 'text', name: 'Pasted text', kind: 'text', source: 'pasted by you', details: { text: query } });
    // The research pack's verified profiles (accents ignored).
    const pack = this.svc.pack;
    if (pack) {
      for (const p of pack.profiles) {
        const names = [p.name, ...p.aliases].map(normRef).filter(Boolean);
        const hit = names.find((n) => norm === n || new RegExp(`(^| )${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(norm));
        if (hit) return insert({
          status: 'resolved', name: p.name, kind: 'artist', identity: p.resolved, source: `research pack ${pack.version}, checked ${pack.built || 'Oct 2026'}`,
          details: { characteristics: p.characteristics.map((c) => `${c.text}${c.evidence === 'analytical_inference' ? ' (our reading)' : ''}`), profileId: p.id },
        });
      }
    }
    // An earlier lookup he didn't reject.
    const [cached] = await this.db.query<{ id: string }>(`SELECT id FROM refs WHERE norm=$1 AND rejected=0 AND status IN ('resolved','ambiguous') ORDER BY updated_at DESC LIMIT 1`, [norm]);
    if (cached) return this.ref(cached.id);
    const writer = this.svc.writer;
    if (!writer?.live || !writer.search) return insert({ status: 'unavailable', source: 'no lookup available', details: { note: 'Songroom can’t look this up right now. Describe what you like about it instead.' } });
    const refId = newId('ref_');
    await this.db.query(`INSERT INTO refs(id, query, norm, status, source, created_at, updated_at) VALUES ($1,$2,$3,'pending','web search',$4,$4)`, [refId, query, norm, now]);
    const user = referencePrompt(query);
    const run = await this.svc.startRun({
      task: 'reference', threadId: null, songId: null, clientKey, effort: 'medium',
      promptVersion: 'ref1', request: { query }, inputChars: REFERENCE_SYSTEM.length + user.length + 30000,
      exec: async (signal, model) => {
        const r = await writer.search!({ system: REFERENCE_SYSTEM, user, effort: 'medium', maxTokens: 6000, model, signal, maxUses: 4 });
        const m = r.text.match(/\{[\s\S]*\}/);
        let parsed: ReturnType<typeof referenceZ.parse> | null = null;
        try { parsed = m ? referenceZ.parse(JSON.parse(m[0])) : null; } catch { parsed = null; }
        if (!parsed) throw new WriterError('bad_output', 'The lookup came back unreadable.', r.usage as Usage);
        return { result: { ...parsed, sources: r.sources.slice(0, 8) } as unknown as Record<string, unknown>, usage: r.usage, requestId: r.requestId, model: r.model, live: true };
      },
      onSuccess: async (_runId, result) => {
        const out = result as unknown as { status: string; candidates: RefRow['candidates']; sources: Array<{ url: string; title: string }> };
        const one = out.status === 'resolved' && out.candidates[0];
        await this.db.query(`UPDATE refs SET status=$2, name=$3, kind=$4, identity=$5, details=$6, candidates=$7, updated_at=$8 WHERE id=$1`, [
          refId, one ? 'resolved' : out.status === 'ambiguous' && out.candidates.length ? 'ambiguous' : 'not_found',
          one ? one.name : '', one ? one.kind : '', one ? one.identity : '',
          JSON.stringify({ characteristics: one ? one.characteristics.map((c) => `${c} (from web sources)`) : [], sources: out.sources }),
          JSON.stringify(out.candidates.slice(0, 4)), new Date().toISOString(),
        ]);
      },
    });
    await this.db.query(`UPDATE refs SET run_id=$2 WHERE id=$1`, [refId, run.id]);
    return this.ref(refId);
  }

  async chooseRef(id: string, index: number) {
    const r = await this.ref(id);
    const c = r.candidates[index];
    if (!c) throw new AppError(400, 'bad_choice', 'That option isn’t there.');
    await this.db.query(`UPDATE refs SET status='resolved', name=$2, kind=$3, identity=$4, details=$5, updated_at=$6 WHERE id=$1`,
      [id, c.name, c.kind, c.identity, JSON.stringify({ ...r.details, characteristics: c.characteristics.map((x) => `${x} (from web sources)`) }), new Date().toISOString()]);
    return this.ref(id);
  }

  /** "Not this one": drop it everywhere it was attached so none of its traits carry over. */
  async rejectRef(id: string) {
    await this.db.query(`UPDATE refs SET rejected=1, updated_at=$2 WHERE id=$1`, [id, new Date().toISOString()]);
    const d = await this.direction();
    if (d.refId === id) await this.setDirection({ refId: null });
    const songs = await this.db.query<{ id: string; context: StoredContext }>(`SELECT id, context FROM songs WHERE context LIKE $1`, [`%${id}%`]);
    for (const g of songs) await this.db.query(`UPDATE songs SET context=$2 WHERE id=$1`, [g.id, JSON.stringify({ ...g.context, refIds: (g.context.refIds ?? []).filter((x) => x !== id) })]);
    return { ok: true };
  }

  async patchRef(id: string, patch: { want?: string }) {
    if (patch.want !== undefined) await this.db.query(`UPDATE refs SET want=$2, updated_at=$3 WHERE id=$1`, [id, patch.want.slice(0, 1000), new Date().toISOString()]);
    return this.ref(id);
  }

  async refsForPrompt(ids: string[]): Promise<RefForPrompt[]> {
    const out: RefForPrompt[] = [];
    for (const id of ids) {
      const [r] = await this.db.query<RefRow>(`SELECT * FROM refs WHERE id=$1 AND rejected=0`, [id]);
      if (!r) continue;
      if (r.status === 'text') out.push({ name: 'Pasted text', identity: '', source: 'pasted', characteristics: [], want: r.want, pastedText: r.details.text ?? r.query });
      else if (r.status === 'resolved') out.push({ name: r.name, identity: r.identity, source: r.source, characteristics: r.details.characteristics ?? [], want: r.want });
      else out.push({ name: r.query, identity: 'not verified: Songroom could not identify this reference', source: 'unverified', characteristics: [], want: r.want });
    }
    return out;
  }

  // ------------------------------------------------------------ workspace
  private async storedContext(songId: string): Promise<StoredContext> {
    const [row] = await this.db.query<{ context: StoredContext }>(`SELECT context FROM songs WHERE id=$1`, [songId]);
    if (!row) throw new AppError(404, 'not_found', 'Song not found.');
    return row.context ?? {};
  }

  /** The working context as shown and as sent. A rhyme linked to a line follows that line, visibly. */
  async contextView(songId: string, sections: Section[]) {
    const c = await this.storedContext(songId);
    let changed = false;
    if (c.rhyme?.mode === 'linked' && c.rhyme.lineId) {
      const line = findLine(sections, c.rhyme.lineId);
      if (!line) { c.rhyme = { word: c.rhyme.word, mode: 'fixed', notice: { from: c.rhyme.word, to: c.rhyme.word } }; changed = true; }
      else {
        const w = endWord(line.text);
        if (w && w !== c.rhyme.word) { c.rhyme = { ...c.rhyme, notice: { from: c.rhyme.word, to: w }, word: w }; changed = true; }
      }
    }
    if (changed) await this.db.query(`UPDATE songs SET context=$2 WHERE id=$1`, [songId, JSON.stringify(c)]);
    const refs = [];
    for (const id of c.refIds ?? []) { const r = await this.ref(id).catch(() => null); if (r && !r.rejected) refs.push(r); }
    const rhymeLine = c.rhyme?.mode === 'linked' && c.rhyme.lineId ? findLine(sections, c.rhyme.lineId)?.text ?? null : null;
    return {
      meaning: c.meaning ?? '', meaningSource: c.meaningSource ?? null, narrator: c.narrator ?? '',
      rhyme: c.rhyme ? { ...c.rhyme, line: rhymeLine } : null,
      rhythm: c.rhythm ? { sample: c.rhythm.sample, syllables: syllables(c.rhythm.sample) } : null,
      refs, lastInstruction: c.lastInstruction ?? '',
    };
  }

  async setContext(songId: string, patch: { meaning?: string; narrator?: string; rhyme?: { word?: string; lineId?: string } | null; rhythm?: { sample: string } | null; refIds?: string[]; clearNotice?: boolean }) {
    const c = await this.storedContext(songId);
    if (patch.meaning !== undefined) { c.meaning = patch.meaning.slice(0, 500); c.meaningSource = 'typed'; }
    if (patch.narrator !== undefined) c.narrator = patch.narrator.slice(0, 300);
    if (patch.rhyme === null) c.rhyme = null;
    else if (patch.rhyme) {
      if (patch.rhyme.lineId) {
        const ws = await this.svc.songContext(songId);
        const line = findLine(ws.sections, patch.rhyme.lineId);
        if (!line) throw new AppError(409, 'unknown_line', 'That line no longer exists.');
        c.rhyme = { word: endWord(line.text), mode: 'linked', lineId: line.id, notice: null };
      } else if (patch.rhyme.word?.trim()) c.rhyme = { word: patch.rhyme.word.trim().slice(0, 60), mode: 'fixed', notice: null };
    }
    if (patch.clearNotice && c.rhyme) c.rhyme.notice = null;
    if (patch.rhythm === null) c.rhythm = null;
    else if (patch.rhythm?.sample?.trim()) c.rhythm = { sample: patch.rhythm.sample.trim().slice(0, 300) };
    if (patch.refIds) c.refIds = patch.refIds.slice(0, 3);
    await this.db.query(`UPDATE songs SET context=$2 WHERE id=$1`, [songId, JSON.stringify(c)]);
    const ws = await this.svc.songContext(songId);
    return this.contextView(songId, ws.sections);
  }

  async workspace(songId: string) {
    const song = await this.svc.song(songId) as unknown as Record<string, unknown> & { sections: Section[]; current_rev: number; idea_id: string | null; palette: string | null; motif: number };
    const context = await this.contextView(songId, song.sections);
    let idea: { id: string; title: string; concept: string; lines: Array<{ id: string; text: string }>; palette: string | null; title_parts: string[] | null } | null = null;
    if (song.idea_id) [idea] = await this.db.query(`SELECT id, title, concept, lines, palette, title_parts FROM ideas WHERE id=$1`, [song.idea_id]);
    const scraps = await this.db.query<FragmentRow>(
      `SELECT id, idea_id, song_id, text, saved, source, ask, created_at, saved_at FROM fragments WHERE song_id=$1 OR (idea_id IS NOT NULL AND idea_id=$2) ORDER BY created_at, rowid`, [songId, song.idea_id ?? '']);
    const sets = await this.suggestionSets(songId, 15);
    const [seedRev] = await this.db.query<{ rev: number }>(`SELECT rev FROM song_revisions WHERE song_id=$1 AND source='insert:seed' LIMIT 1`, [songId]);
    return {
      seedAdded: !!seedRev,
      ...song, palette: (song.palette ?? idea?.palette ?? PALETTES[song.motif % 3]) as Palette, context,
      idea: idea ? { ...idea, title_parts: idea.title_parts } : null,
      scraps: scraps.map((f) => ({ ...f, saved: !!f.saved })), sets,
    };
  }

  async suggestionSets(songId: string, limit = 15) {
    const rows = await this.db.query<SetRow>(`SELECT * FROM suggestion_sets WHERE song_id=$1 ORDER BY created_at DESC, rowid DESC LIMIT $2`, [songId, limit]);
    for (const r of rows) {
      if (r.status === 'running' && r.run_id) {
        const run = await this.svc.getRun(r.run_id);
        if (run.status !== 'running' && run.status !== 'succeeded') {
          const err = (run.error as { code?: string; message?: string } | null) ?? { code: 'failed', message: 'That request failed.' };
          await this.db.query(`UPDATE suggestion_sets SET status='failed', error=$2 WHERE id=$1`, [r.id, JSON.stringify(err)]);
          r.status = 'failed'; r.error = { code: err.code ?? 'failed', message: err.message ?? 'That request failed.' };
        }
      }
    }
    return rows;
  }

  async suggestionSet(id: string) {
    const [row] = await this.db.query<SetRow>(`SELECT * FROM suggestion_sets WHERE id=$1`, [id]);
    if (!row) throw new AppError(404, 'not_found', 'Not found.');
    if (row.status === 'running') { await this.suggestionSets(row.song_id, 50); const [again] = await this.db.query<SetRow>(`SELECT * FROM suggestion_sets WHERE id=$1`, [id]); return again; }
    return row;
  }

  /** Read deterministic context changes from a short instruction; everything else stays as it was. */
  private contextFromInstruction(c: StoredContext, instruction: string, sections: Section[], targets: Target[]): StoredContext {
    const next: StoredContext = { ...c };
    const t = instruction.trim();
    if (/\b(no|forget the|drop the|without (a |the )?)rhym/i.test(t) || /\bdon'?t rhyme\b/i.test(t)) next.rhyme = null;
    const m = t.match(/\brhym\w*\s+(?:it\s+|that\s+)?with\s+["“‘']?([^"”’'.,;!?]{1,40}?)["”’']?\s*(?:[.,;!?]|$|\s(?:and|but|keep|so|while)\b)/i);
    if (m) {
      const phrase = m[1].trim();
      if (/^(this|that|the)\s+(line|one)(\s+(above|before))?$|^the\s+(previous|last|line before|line above)(\s+line)?$|^the\s+line\s+(above|before)$/i.test(phrase)) {
        const lines = allLines(sections);
        const first = targets[0] ? lines.findIndex((l) => l.id === targets[0].lineId) : lines.length;
        const prev = first > 0 ? lines[first - 1] : null;
        if (prev) next.rhyme = { word: endWord(prev.text), mode: 'linked', lineId: prev.id, notice: null };
      } else {
        const words = phrase.split(/\s+/);
        next.rhyme = { word: words.length <= 3 ? phrase : words[words.length - 1], mode: 'fixed', notice: null };
      }
    }
    if (/\b(keep|match|same|hold)\s+(the\s+|its\s+|that\s+)?(rhythm|syllables?|shape|meter|metre|flow|cadence|scansion)\b/i.test(t) && targets.length) {
      const first = targets[0];
      const line = findLine(sections, first.lineId);
      if (line) next.rhythm = { sample: targets.length === 1 ? (first.kind === 'span' ? first.expected : line.text) : targets.map((x) => findLine(sections, x.lineId)?.text ?? '').join(' / ') };
    }
    next.lastInstruction = t.slice(0, 1000);
    return next;
  }

  /** Start a set of proposals (shown one at a time). Browsing never changes the lyric; only Keep does. */
  async suggest(songId: string, input: { baseRev: number; targets: Target[]; afterLineId?: string | null; instruction: string; clientKey: string | null; parentSetId?: string | null }) {
    const instruction = input.instruction.trim();
    if (!instruction) throw new AppError(400, 'empty', 'Say what you want.');
    if (input.clientKey) {
      const [dup] = await this.db.query<{ id: string; run_id: string | null }>(`SELECT id, run_id FROM suggestion_sets WHERE client_key=$1`, [input.clientKey]);
      if (dup) return { setId: dup.id, runId: dup.run_id };
    }
    const ctx = await this.svc.songContext(songId);
    if (ctx.rev !== input.baseRev) throw new AppError(409, 'conflict', 'The song changed since you selected this. Reselect and try again.', { currentRev: ctx.rev });
    const locks = new Set(ctx.locks);
    let targets: Target[];
    try { targets = resolveTargets(ctx.sections, input.targets ?? [], locks); }
    catch (e) { if (e instanceof EditError) throw new AppError(409, e.code, e.message); throw e; }
    const mode: 'replace' | 'add' = targets.length ? 'replace' : 'add';
    const afterLineId = mode === 'add' ? (input.afterLineId ?? null) : null;
    if (afterLineId && !findLine(ctx.sections, afterLineId)) throw new AppError(409, 'unknown_line', 'That line no longer exists.');

    const stored = await this.storedContext(songId);
    const nextCtx = this.contextFromInstruction(stored, instruction, ctx.sections, targets);
    await this.db.query(`UPDATE songs SET context=$2 WHERE id=$1`, [songId, JSON.stringify(nextCtx)]);
    const setId = newId('ss_');
    const parentId = input.parentSetId ? (await this.db.query<{ id: string; parent_id: string | null }>(`SELECT id, parent_id FROM suggestion_sets WHERE id=$1 AND song_id=$2`, [input.parentSetId, songId]))[0] : null;
    const rootId = parentId ? (parentId.parent_id ?? parentId.id) : null;
    const insertSet = async (status: string, items: SetItem[] | null, runId: string | null) => {
      await this.db.query(
        `INSERT INTO suggestion_sets(id, song_id, run_id, base_rev, mode, targets, instruction, context, items, status, parent_id, client_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [setId, songId, runId, ctx.rev, mode, JSON.stringify({ targets, afterLineId }), instruction, JSON.stringify(nextCtx), items ? JSON.stringify(items) : null, status, rootId, input.clientKey],
      );
    };

    // Literal, unambiguous replacements: done directly, no writer, no cost.
    const literal = parseLiteral(instruction);
    if (literal) {
      const reps = literalReplacements(ctx.sections, targets.length ? targets : null, literal.from, literal.to, locks);
      if (!reps.length) throw new AppError(400, 'not_found', `Couldn’t find “${literal.from}” ${targets.length ? 'in your selection' : 'in unlocked lines'}.`);
      await insertSet('done', [{ replacements: reps, diff: diffFor(ctx.sections, reps), checks: [], direct: true }], null);
      if (!targets.length) await this.db.query(`UPDATE suggestion_sets SET mode='replace' WHERE id=$1`, [setId]);
      return { setId, runId: null };
    }

    // Everything already offered for this same selection is passed on so "Another" doesn't repeat.
    const avoid: string[] = [];
    if (rootId) {
      const chain = await this.db.query<{ items: SetItem[] | null }>(`SELECT items FROM suggestion_sets WHERE (id=$1 OR parent_id=$1) AND items IS NOT NULL`, [rootId]);
      for (const c of chain) for (const it of c.items ?? []) avoid.push(it.lines ? it.lines.join(' / ') : (it.diff ?? []).map((d) => d.after).join(' / '));
    }
    const view = await this.contextView(songId, ctx.sections);
    const wctx: WorkspaceContext = { meaning: view.meaning, narrator: view.narrator, rhyme: view.rhyme ? { word: view.rhyme.word, mode: view.rhyme.mode, line: view.rhyme.line ?? undefined } : null, rhythm: view.rhythm };
    const refs = await this.refsForPrompt(nextCtx.refIds ?? []);
    const s = await this.svc.settings();
    // Replacements count as precise edits (notes on by default); added lines follow the 'all' scope.
    const plan: PromptPlan = { variant: PROMPT_VERSION, pack: mode === 'replace' ? s.craftPack !== 'off' : s.craftPack === 'all' };
    const craft = this.svc.craftFor(plan, { text: instruction, brief: ctx.brief, reference: refs.map((r) => r.name).join(', ') || null, task: mode === 'replace' ? 'edit' : 'lines' });
    const targetDescs = targets.map((t, i) => {
      const line = findLine(ctx.sections, t.lineId)!;
      return { id: `T${i + 1}`, describe: t.kind === 'line' ? `the whole line “${line.text}”` : `only the words “${t.expected}” in the line “${line.text}” (keep “${line.text.slice(0, t.start)}” before and “${line.text.slice(t.end)}” after)` };
    });
    const taste = await this.svc.tasteFor(instruction);
    const system = systemCore(plan.variant) + (taste ? `\n\n${taste}` : '');
    const user = suggestPrompt({
      mode, song: ctx, annotated: annotate(ctx.sections, targets, locks), targets: targetDescs,
      insertAfter: afterLineId ? findLine(ctx.sections, afterLineId)!.text : null, instruction,
      context: contextBlock(wctx), references: referenceBlock(refs), avoid: avoid.slice(-16), count: SUGGEST_COUNT, craft: craft.block,
    });
    const det = extractConstraints(instruction);
    const run = await this.svc.startRun({
      task: 'suggest', threadId: null, songId, clientKey: input.clientKey, effort: s.effortEdit,
      promptVersion: `${plan.variant}${craft.record ? '+pack' : ''}/${WORKSPACE_TEMPLATE}`,
      request: { setId, instruction, baseRev: ctx.rev, mode, targets, afterLineId, context: wctx, refs: nextCtx.refIds ?? [], pack: craft.record },
      inputChars: system.length + user.length,
      exec: async (signal, model) => {
        const r = await this.svc.call('suggest', system, user, mode === 'replace' ? suggestReplaceSchema : suggestAddSchema, s.effortEdit, signal, model);
        const parsed = mode === 'replace' ? suggestReplaceZ.safeParse(r.json) : suggestAddZ.safeParse(r.json);
        if (!parsed.success) throw new WriterError('bad_output', 'The writer returned an unexpected shape.', r.usage);
        return { result: parsed.data as unknown as Record<string, unknown>, usage: r.usage, requestId: r.requestId, model: r.model, live: r.live };
      },
      onSuccess: async (_runId, result) => {
        const c = mergeConstraints(null, det);
        const items: SetItem[] = [];
        if (mode === 'replace') {
          const out = result as unknown as { options: Array<{ targets: Array<{ target: string; text: string }> }> };
          for (const o of out.options) {
            const byT = new Map(o.targets.map((t) => [t.target.trim().toUpperCase(), t.text]));
            const proposals = targets.map((_, i) => byT.get(`T${i + 1}`));
            if (proposals.some((p) => p === undefined) || o.targets.length !== targets.length) continue;
            let reps: Replacement[];
            try { reps = buildReplacements(ctx.sections, targets, proposals as string[]); } catch { continue; }
            if (reps.every((r) => findLine(ctx.sections, r.lineId)!.text === r.newText)) continue;
            const checks: Check[] = [];
            const changed = reps.map((r) => r.newText);
            if (c.mustEndWith) checks.push({ label: `ends “${c.mustEndWith}”`, ok: endsWithPhrase(changed[changed.length - 1] ?? '', c.mustEndWith) });
            if (c.mustStartWith) checks.push({ label: `starts “${c.mustStartWith}”`, ok: startsWithPhrase(changed[0] ?? '', c.mustStartWith) });
            for (const w of c.forbidden) if ((proposals as string[]).some((p) => containsWord(p, w))) checks.push({ label: `avoids “${w}”`, ok: false });
            items.push({ replacements: reps, diff: diffFor(ctx.sections, reps), checks });
          }
        } else {
          const out = result as unknown as { options: Array<{ lines: string[] }> };
          for (const o of out.options) {
            const lines = o.lines.map((l) => l.replace(/\s+$/g, '')).filter((l) => l.trim());
            if (!lines.length) continue;
            const checks: Check[] = [];
            for (const w of c.forbidden) if (lines.some((l) => containsWord(l, w))) checks.push({ label: `avoids “${w}”`, ok: false });
            if (c.mustEndWith) checks.push({ label: `ends “${c.mustEndWith}”`, ok: endsWithPhrase(lines[lines.length - 1], c.mustEndWith) });
            items.push({ lines, checks });
          }
        }
        const upd = (result as { update?: { meaning: string; narrator: string } }).update;
        const note = String((result as { note?: string }).note ?? '').trim();
        if (upd && (upd.meaning.trim() || upd.narrator.trim())) {
          const cur = await this.storedContext(songId);
          if (upd.meaning.trim()) { cur.meaning = upd.meaning.trim().slice(0, 500); cur.meaningSource = 'instruction'; }
          if (upd.narrator.trim()) cur.narrator = upd.narrator.trim().slice(0, 300);
          await this.db.query(`UPDATE songs SET context=$2 WHERE id=$1`, [songId, JSON.stringify(cur)]);
        }
        await this.db.query(`UPDATE suggestion_sets SET items=$2, status=$3, error=$4 WHERE id=$1`, [setId, JSON.stringify(items),
          items.length ? 'done' : 'failed', items.length ? (note ? JSON.stringify({ code: 'note', message: note }) : null) : JSON.stringify({ code: 'empty', message: note || 'Nothing usable came back. Try again or rephrase.' })]);
      },
    });
    await insertSet('running', null, run.id);
    return { setId, runId: run.id };
  }

  /** Apply one proposal as a new revision. Only the authorised span or insertion changes. */
  async keep(songId: string, input: { setId: string; index: number; clientKey: string | null }) {
    return this.once(input.clientKey, async () => {
      const set = await this.suggestionSet(input.setId);
      if (set.song_id !== songId) throw new AppError(404, 'not_found', 'Not found.');
      const item = set.items?.[input.index];
      if (!item) throw new AppError(400, 'bad_choice', 'That suggestion isn’t available.');
      if (set.mode === 'replace' && item.replacements) {
        const r = await this.svc.accept(songId, set.base_rev, item.replacements, item.direct ? 'direct' : 'writer', set.run_id, set.instruction.slice(0, 280));
        return { ...r };
      }
      if (item.lines) return this.insertAt(songId, { baseRev: set.base_rev, afterLineId: set.targets.afterLineId, text: item.lines.join('\n'), asSection: false, note: set.instruction.slice(0, 280), source: 'insert:writer', runId: set.run_id });
      throw new AppError(400, 'bad_choice', 'That suggestion can’t be applied.');
    });
  }

  /** Add a scrap, seed or new lines at a point. Never rewrites existing lines. */
  async insertAt(songId: string, input: { baseRev: number; afterLineId: string | null; text: string; asSection: boolean; note: string; source: string; runId?: string | null }) {
    return this.svc.commitRevision(songId, input.baseRev, (sections) => {
      try { return insertLines(sections, input.afterLineId, input.text, input.asSection); }
      catch (e) { if (e instanceof EditError) throw new AppError(409, e.code, e.message); throw e; }
    }, input.source, input.note, input.runId ?? null);
  }

  async addToLyrics(songId: string, input: { baseRev: number; afterLineId: string | null; text: string; clientKey: string | null; source: string }) {
    return this.once(input.clientKey, () => this.insertAt(songId, { baseRev: input.baseRev, afterLineId: input.afterLineId, text: input.text, asSection: !input.afterLineId, note: 'Added from starting points', source: input.source === 'seed' ? 'insert:seed' : 'insert:scrap' }));
  }
}

export function ideaLines(i: { lines: Array<{ text: string }> }): string { return i.lines.map((l) => l.text).join('\n'); }
export { renderLyrics };
