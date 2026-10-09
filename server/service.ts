// Domain operations: threads, runs, ideas, songs, edits, Suno, settings, budget.
// Routes in app.ts are thin wrappers around these.

import type { Db } from './db.js';
import {
  type Section, type Target, type Replacement, newId, parseLyrics, renderLyrics, allLines, findLine,
  reparsePreservingIds, resolveTargets, buildReplacements, applyReplacements, parseLiteral,
  literalReplacements, EditError,
} from './engine/lyrics.js';
import { type Constraints, type Check, checkCandidate, extractConstraints, mergeConstraints, containsWord, endsWithPhrase, startsWithPhrase } from './engine/validate.js';
import { writeSchema, writeZ, editSchema, editZ, sunoSchema, sunoZ } from './engine/schemas.js';
import { SYSTEM_CORE, PROMPT_VERSION, tasteBlock, writePrompt, editPrompt, sunoPrompt, type Turn, type VoiceExample, type SongContext } from './engine/prompts.js';
import { type Writer, type Effort, type Usage, WriterError, costOf, worstCaseCost, RATES } from './engine/writer.js';

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public extra?: Record<string, unknown>) { super(message); }
}

export type Settings = {
  model: string;
  effortCreative: Effort;
  effortEdit: Effort;
  dailyCapUsd: number;
  monthlyCapUsd: number;
  taste: string;
};

const DEFAULTS: Settings = {
  model: 'claude-opus-5-5',
  effortCreative: 'high',
  effortEdit: 'medium',
  dailyCapUsd: 10,
  monthlyCapUsd: 150,
  taste: '',
};

const MAX_TOKENS = { write: 24000, edit: 12000, suno: 10000 };

export type Task = 'write' | 'edit' | 'suno';

export class Service {
  private aborts = new Map<string, AbortController>();
  private budgetLock: Promise<unknown> = Promise.resolve();
  private pending = new Set<Promise<unknown>>();

  constructor(public db: Db, public writer: Writer | null) {}

  /** Await all background runs (used by tests and graceful shutdown). */
  async idle(): Promise<void> {
    while (this.pending.size) await Promise.allSettled([...this.pending]);
  }

  async recoverInterrupted(): Promise<number> {
    const rows = await this.db.query(`UPDATE runs SET status='interrupted', finished_at=now(),
      error='{"code":"interrupted","message":"The server restarted during this request. It may have been billed. Retry if you need it."}'::jsonb
      WHERE status='running' RETURNING id`);
    return rows.length;
  }

  // ---------------- settings ----------------
  async settings(): Promise<Settings> {
    const rows = await this.db.query<{ key: string; value: unknown }>(`SELECT key, value FROM settings`);
    const s: Record<string, unknown> = { ...DEFAULTS };
    for (const r of rows) if (r.key in DEFAULTS) s[r.key] = r.value;
    return s as Settings;
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    const efforts = ['low', 'medium', 'high', 'xhigh', 'max'];
    for (const [k, v] of Object.entries(patch)) {
      if (!(k in DEFAULTS)) continue;
      if (k === 'model' && !(typeof v === 'string' && RATES[v])) throw new AppError(400, 'bad_model', 'Unknown model.');
      if ((k === 'effortCreative' || k === 'effortEdit') && !efforts.includes(v as string)) throw new AppError(400, 'bad_effort', 'Unknown effort.');
      if ((k === 'dailyCapUsd' || k === 'monthlyCapUsd') && !(typeof v === 'number' && v >= 0 && v <= 5000)) throw new AppError(400, 'bad_cap', 'Cap must be between $0 and $5000.');
      if (k === 'taste' && !(typeof v === 'string' && v.length <= 8000)) throw new AppError(400, 'bad_taste', 'Taste notes are too long.');
      await this.db.query(`INSERT INTO settings(key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [k, JSON.stringify(v)]);
    }
    return this.settings();
  }

  async voiceExamples(): Promise<Array<VoiceExample & { id: string }>> {
    return this.db.query(`SELECT id, direction, text FROM voice_examples ORDER BY created_at DESC`);
  }

  async addVoice(direction: string, text: string) {
    if (!text.trim()) throw new AppError(400, 'empty', 'Paste some lyrics first.');
    if (text.length > 6000) throw new AppError(400, 'too_long', 'Keep each example under 6000 characters.');
    const id = newId('v_');
    await this.db.query(`INSERT INTO voice_examples(id, direction, text) VALUES ($1,$2,$3)`, [id, direction.trim().slice(0, 80), text.replace(/\r\n?/g, '\n')]);
    return { id };
  }

  async deleteVoice(id: string) { await this.db.query(`DELETE FROM voice_examples WHERE id=$1`, [id]); }

  private async tasteFor(request: string): Promise<string> {
    const s = await this.settings();
    const all = await this.voiceExamples();
    // Prefer examples whose direction is mentioned in the request; cap total size.
    const lower = request.toLowerCase();
    const ranked = [...all].sort((a, b) => Number(!!b.direction && lower.includes(b.direction.toLowerCase())) - Number(!!a.direction && lower.includes(a.direction.toLowerCase())));
    const picked: VoiceExample[] = [];
    let size = 0;
    for (const e of ranked) {
      if (picked.length >= 4 || size + e.text.length > 6000) continue;
      picked.push(e); size += e.text.length;
    }
    return tasteBlock(s.taste, picked);
  }

  // ---------------- budget ----------------
  async spend() {
    const [row] = await this.db.query<{ today: string; month: string }>(`
      SELECT
        COALESCE(SUM(CASE WHEN created_at >= (date_trunc('day', now() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles')
          THEN COALESCE(cost_usd, reserved_usd) END), 0) AS today,
        COALESCE(SUM(CASE WHEN created_at >= (date_trunc('month', now() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles')
          THEN COALESCE(cost_usd, reserved_usd) END), 0) AS month
      FROM runs WHERE live`);
    const s = await this.settings();
    return { today: Number(row.today), month: Number(row.month), dailyCapUsd: s.dailyCapUsd, monthlyCapUsd: s.monthlyCapUsd };
  }

  async receipts(limit = 60) {
    return this.db.query(`SELECT id, task, status, model, effort, usage, cost_usd, reserved_usd, live, created_at, finished_at, error->>'code' AS error_code
      FROM runs ORDER BY created_at DESC LIMIT $1`, [limit]);
  }

  // ---------------- runs ----------------
  /**
   * Reserve budget, record the run, then execute it in the background.
   * A repeated clientKey returns the existing run instead of paying twice.
   */
  async startRun(opts: {
    task: Task; threadId: string | null; songId: string | null; clientKey: string | null;
    request: Record<string, unknown>; inputChars: number; effort: Effort;
    exec: (signal: AbortSignal, model: string) => Promise<{ result: Record<string, unknown>; usage: Usage; requestId: string | null; model: string; live: boolean }>;
    onSuccess: (runId: string, result: Record<string, unknown>) => Promise<void>;
  }): Promise<{ id: string; status: string; reused: boolean }> {
    if (opts.clientKey) {
      const [existing] = await this.db.query<{ id: string; status: string }>(`SELECT id, status FROM runs WHERE client_key=$1`, [opts.clientKey]);
      if (existing) return { ...existing, reused: true };
    }
    if (!this.writer) throw new AppError(503, 'no_writer', 'No writer is connected. Add the Anthropic API key in Render to generate.');
    const s = await this.settings();
    const model = s.model;
    const maxTokens = MAX_TOKENS[opts.task];
    const reserve = this.writer.live ? worstCaseCost(model, opts.inputChars, maxTokens) : 0;
    if (reserve === null) throw new AppError(400, 'unknown_price', 'This model has no price on file, so it is blocked.');
    const id = newId('r_');
    const release = await this.lock();
    try {
      if (this.writer.live) {
        const sp = await this.spend();
        if (sp.today + reserve > sp.dailyCapUsd)
          throw new AppError(402, 'daily_cap', `Today's spend cap ($${sp.dailyCapUsd.toFixed(2)}) would be exceeded. Raise it in Settings → Spending.`, sp);
        if (sp.month + reserve > sp.monthlyCapUsd)
          throw new AppError(402, 'monthly_cap', `This month's cap ($${sp.monthlyCapUsd.toFixed(2)}) would be exceeded. Raise it in Settings → Spending.`, sp);
      }
      await this.db.query(
        `INSERT INTO runs(id, thread_id, song_id, task, status, client_key, model, effort, prompt_version, request, reserved_usd, live)
         VALUES ($1,$2,$3,$4,'running',$5,$6,$7,$8,$9,$10,$11)`,
        [id, opts.threadId, opts.songId, opts.task, opts.clientKey, model, opts.effort, PROMPT_VERSION, JSON.stringify(opts.request), reserve, this.writer.live],
      );
    } catch (e) {
      if ((e as { code?: string }).code === '23505' && opts.clientKey) {
        const [existing] = await this.db.query<{ id: string; status: string }>(`SELECT id, status FROM runs WHERE client_key=$1`, [opts.clientKey]);
        if (existing) return { ...existing, reused: true };
      }
      throw e;
    } finally {
      release();
    }

    const ac = new AbortController();
    this.aborts.set(id, ac);
    const p = (async () => {
      try {
        const out = await opts.exec(ac.signal, model);
        const cost = out.live ? costOf(model, out.usage) : 0;
        const updated = await this.db.query(
          `UPDATE runs SET status='succeeded', result=$2, usage=$3, cost_usd=$4, request_id=$5, finished_at=now() WHERE id=$1 AND status='running' RETURNING id`,
          [id, JSON.stringify(out.result), JSON.stringify(out.usage), cost, out.requestId],
        );
        if (updated.length) await opts.onSuccess(id, out.result);
        else await this.db.query(`UPDATE runs SET usage=$2, cost_usd=$3 WHERE id=$1`, [id, JSON.stringify(out.usage), cost]);
      } catch (e) {
        const we = e instanceof WriterError ? e : null;
        const code = we?.code ?? (e instanceof AppError ? e.code : 'internal');
        const message = we?.message ?? (e instanceof AppError ? e.message : 'Something went wrong while writing. Your song is unchanged.');
        if (!we && !(e instanceof AppError)) console.error('run failed', id, e);
        const cost = we?.usage ? costOf(model, we.usage) : null;
        // A failure before any usage is known keeps its reservation as "unknown" spend
        // unless the provider clearly never accepted it.
        const neverSent = we && ['no_key', 'auth', 'rate_limited', 'balance'].includes(we.code);
        await this.db.query(
          `UPDATE runs SET status=CASE WHEN status='cancelled' THEN 'cancelled' ELSE 'failed' END, error=$2, usage=$3, cost_usd=$4, reserved_usd=CASE WHEN $5 THEN 0 ELSE reserved_usd END, finished_at=now() WHERE id=$1`,
          [id, JSON.stringify({ code, message }), we?.usage ? JSON.stringify(we.usage) : null, cost, !!neverSent || !this.writer?.live],
        );
      } finally {
        this.aborts.delete(id);
      }
    })();
    this.pending.add(p);
    p.finally(() => this.pending.delete(p));
    return { id, status: 'running', reused: false };
  }

  private async lock(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>((r) => (release = r));
    const prev = this.budgetLock;
    this.budgetLock = prev.then(() => next);
    await prev;
    return release;
  }

  async getRun(id: string) {
    const [run] = await this.db.query<Record<string, unknown>>(`SELECT id, task, status, thread_id, song_id, result, error, cost_usd, live, created_at, finished_at FROM runs WHERE id=$1`, [id]);
    if (!run) throw new AppError(404, 'not_found', 'Not found.');
    return run;
  }

  async cancelRun(id: string) {
    const rows = await this.db.query(`UPDATE runs SET status='cancelled', finished_at=now() WHERE id=$1 AND status='running' RETURNING id`, [id]);
    this.aborts.get(id)?.abort();
    return { cancelled: rows.length > 0, note: 'If the writer had already started, Anthropic may still bill for it.' };
  }

  private async call(task: Task, system: string, user: string, schema: object, effort: Effort, signal: AbortSignal, model: string) {
    if (!this.writer) throw new WriterError('no_key', 'No writer is connected.');
    return this.writer.write({ system, user, schema, effort, maxTokens: MAX_TOKENS[task], model, signal });
  }

  // ---------------- threads & writing ----------------
  async threads(limit = 40) {
    return this.db.query(`SELECT t.id, t.title, t.song_id, t.updated_at,
        (SELECT COUNT(*) FROM messages m WHERE m.thread_id=t.id)::int AS messages
      FROM threads t WHERE t.song_id IS NULL AND t.kind='normal' ORDER BY t.updated_at DESC LIMIT $1`, [limit]);
  }

  async thread(id: string) {
    const [t] = await this.db.query<Record<string, unknown>>(`SELECT id, title, song_id, updated_at FROM threads WHERE id=$1`, [id]);
    if (!t) throw new AppError(404, 'not_found', 'Session not found.');
    const messages = await this.db.query(`SELECT id, role, text, run_id, payload, created_at FROM messages WHERE thread_id=$1 ORDER BY created_at, id`, [id]);
    const runs = await this.db.query(`SELECT id, task, status, error, created_at FROM runs WHERE thread_id=$1 AND status IN ('running','failed','interrupted','cancelled') ORDER BY created_at`, [id]);
    return { ...t, messages, runs };
  }

  async deleteThread(id: string) {
    await this.db.query(`UPDATE runs SET status='cancelled' WHERE thread_id=$1 AND status='running'`, [id]);
    await this.db.query(`DELETE FROM threads WHERE id=$1 AND song_id IS NULL`, [id]);
  }

  private async recentTurns(threadId: string, excludeId?: string): Promise<Turn[]> {
    const rows = await this.db.query<{ id: string; role: 'user' | 'assistant'; text: string; payload: Record<string, unknown> | null }>(
      `SELECT id, role, text, payload FROM messages WHERE thread_id=$1 ORDER BY created_at DESC, id DESC LIMIT 14`, [threadId]);
    return rows.reverse().filter((r) => r.id !== excludeId).map((r) => ({ role: r.role, text: compactMessage(r.text, r.payload) }));
  }

  async songContext(songId: string): Promise<SongContext & { sections: Section[]; rev: number; locks: string[] }> {
    const [song] = await this.db.query<{ title: string; brief: string; current_rev: number; locks: string[] }>(`SELECT title, brief, current_rev, locks FROM songs WHERE id=$1`, [songId]);
    if (!song) throw new AppError(404, 'not_found', 'Song not found.');
    const [rev] = await this.db.query<{ sections: Section[] }>(`SELECT sections FROM song_revisions WHERE song_id=$1 AND rev=$2`, [songId, song.current_rev]);
    return { title: song.title, brief: song.brief, lyrics: renderLyrics(rev.sections), sections: rev.sections, rev: song.current_rev, locks: song.locks ?? [] };
  }

  async sendMessage(input: { threadId: string | null; songId?: string | null; text: string; reference?: string | null; focus?: string | null; clientKey: string | null; threadKind?: 'normal' | 'eval' }) {
    const text = input.text.trim();
    if (!text) throw new AppError(400, 'empty', 'Type a request first.');
    if (text.length > 20000) throw new AppError(400, 'too_long', 'That message is too long.');
    if (input.clientKey) {
      const [existing] = await this.db.query<{ id: string; thread_id: string; status: string }>(`SELECT id, thread_id, status FROM runs WHERE client_key=$1`, [input.clientKey]);
      if (existing) return { threadId: existing.thread_id, runId: existing.id, reused: true };
    }
    let threadId = input.threadId;
    let songId = input.songId ?? null;
    if (threadId) {
      const [t] = await this.db.query<{ song_id: string | null }>(`SELECT song_id FROM threads WHERE id=$1`, [threadId]);
      if (!t) throw new AppError(404, 'not_found', 'Session not found.');
      songId = t.song_id;
    } else if (songId) {
      threadId = await this.songThread(songId);
    } else {
      threadId = newId('t_');
      await this.db.query(`INSERT INTO threads(id, title, kind) VALUES ($1,$2,$3)`, [threadId, titleFrom(text), input.threadKind ?? 'normal']);
    }
    const turns = await this.recentTurns(threadId);
    const userMsgId = newId('m_');
    const reference = input.reference?.trim() || null;
    const focus = input.focus?.trim() || null;
    await this.db.query(`INSERT INTO messages(id, thread_id, role, text, payload) VALUES ($1,$2,'user',$3,$4)`,
      [userMsgId, threadId, text, JSON.stringify({ reference, focus })]);
    await this.db.query(`UPDATE threads SET updated_at=now() WHERE id=$1`, [threadId]);

    const song = songId ? await this.songContext(songId) : null;
    const taste = await this.tasteFor(text + ' ' + (reference ?? ''));
    const system = SYSTEM_CORE + (taste ? `\n\n${taste}` : '');
    const user = writePrompt({ request: text, reference, turns, song, focus });
    const s = await this.settings();
    const det = extractConstraints(text);
    try {
      const run = await this.startRun({
        task: 'write', threadId, songId, clientKey: input.clientKey, effort: s.effortCreative,
        request: { text, reference, focus, songRev: song?.rev ?? null }, inputChars: system.length + user.length,
        exec: async (signal, model) => {
          const r = await this.call('write', system, user, writeSchema, s.effortCreative, signal, model);
          const parsed = writeZ.safeParse(r.json);
          if (!parsed.success) throw new WriterError('bad_output', 'The writer returned an unexpected shape.', r.usage);
          return { result: shapeWrite(parsed.data, det), usage: r.usage, requestId: r.requestId, model: r.model, live: r.live };
        },
        onSuccess: async (runId, result) => {
          await this.db.query(`INSERT INTO messages(id, thread_id, role, text, run_id, payload) VALUES ($1,$2,'assistant',$3,$4,$5)`,
            [newId('m_'), threadId, String(result.reply ?? ''), runId, JSON.stringify(result)]);
          await this.db.query(`UPDATE threads SET updated_at=now() WHERE id=$1`, [threadId]);
        },
      });
      return { threadId, runId: run.id, reused: run.reused };
    } catch (e) {
      // Keep the typed message so nothing is lost, and say why nothing came back.
      if (e instanceof AppError) {
        await this.db.query(`UPDATE messages SET payload = payload || $2 WHERE id=$1`, [userMsgId, JSON.stringify({ blocked: e.message })]);
      }
      throw e;
    }
  }

  // ---------------- ideas (journal) ----------------
  async saveIdea(input: { sourceKey: string | null; kind: 'seed' | 'line'; title: string; concept: string; lines: string[]; sourceRunId?: string | null }) {
    if (!['seed', 'line'].includes(input.kind)) throw new AppError(400, 'bad_kind', 'Unknown item type.');
    const lines = input.lines.map((t) => ({ id: newId('l_'), text: String(t) }));
    const original = { title: input.title, concept: input.concept, lines: input.lines };
    const id = newId('i_');
    const rows = await this.db.query<{ id: string }>(
      `INSERT INTO ideas(id, kind, title, concept, lines, original, source_run_id, source_key, motif)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (source_key) DO NOTHING RETURNING id`,
      [id, input.kind, input.title.slice(0, 200), input.concept.slice(0, 2000), JSON.stringify(lines), JSON.stringify(original), input.sourceRunId ?? null, input.sourceKey, motifFor(id)],
    );
    if (rows.length) return { id, created: true };
    const [existing] = await this.db.query<{ id: string }>(`SELECT id FROM ideas WHERE source_key=$1`, [input.sourceKey]);
    return { id: existing.id, created: false };
  }

  async savedKeys(runIds: string[]): Promise<Record<string, string>> {
    if (!runIds.length) return {};
    const rows = await this.db.query<{ id: string; source_key: string }>(`SELECT id, source_key FROM ideas WHERE source_run_id = ANY($1) AND source_key IS NOT NULL`, [runIds]);
    return Object.fromEntries(rows.map((r) => [r.source_key, r.id]));
  }

  async idea(id: string) {
    const [row] = await this.db.query(`SELECT * FROM ideas WHERE id=$1`, [id]);
    if (!row) throw new AppError(404, 'not_found', 'Not found.');
    const songs = await this.db.query(`SELECT id, title FROM songs WHERE idea_id=$1 AND NOT archived`, [id]);
    return { ...row, songs };
  }

  async updateIdea(id: string, patch: { title?: string; concept?: string; lines?: string[]; notes?: string; starred?: boolean; archived?: boolean }) {
    const [cur] = await this.db.query<{ lines: Array<{ id: string; text: string }> }>(`SELECT lines FROM ideas WHERE id=$1`, [id]);
    if (!cur) throw new AppError(404, 'not_found', 'Not found.');
    let lines = cur.lines;
    if (patch.lines) lines = patch.lines.map((text, i) => ({ id: cur.lines[i]?.id ?? newId('l_'), text: String(text).replace(/\r\n?/g, '\n') }));
    await this.db.query(
      `UPDATE ideas SET title=COALESCE($2,title), concept=COALESCE($3,concept), lines=$4, notes=COALESCE($5,notes),
        starred=COALESCE($6,starred), archived=COALESCE($7,archived), updated_at=now() WHERE id=$1`,
      [id, patch.title ?? null, patch.concept ?? null, JSON.stringify(lines), patch.notes ?? null, patch.starred ?? null, patch.archived ?? null],
    );
    return this.idea(id);
  }

  async deleteIdea(id: string) {
    // Songs developed from it keep everything; they just lose the link.
    await this.db.query(`UPDATE songs SET idea_id=NULL WHERE idea_id=$1`, [id]);
    await this.db.query(`DELETE FROM ideas WHERE id=$1`, [id]);
  }

  async journal(q: string, filter: string) {
    const like = `%${q.trim().toLowerCase()}%`;
    const ideas = filter === 'songs' ? [] : await this.db.query(
      `SELECT id, kind, title, concept, lines, starred, motif, updated_at, created_at FROM ideas
       WHERE NOT archived AND ($1 = '%%' OR lower(title || ' ' || concept || ' ' || lines::text || ' ' || notes) LIKE $1)
         AND ($2 = 'all' OR ($2 = 'starred' AND starred) OR ($2 = 'seeds' AND kind='seed') OR ($2 = 'lines' AND kind='line'))
       ORDER BY updated_at DESC LIMIT 300`, [like, filter]);
    const songs = ['seeds', 'lines'].includes(filter) ? [] : await this.db.query(
      `SELECT s.id, s.title, s.brief, s.starred, s.motif, s.updated_at, s.created_at, r.sections FROM songs s
       JOIN song_revisions r ON r.song_id=s.id AND r.rev=s.current_rev
       WHERE NOT s.archived AND s.kind='normal' AND ($1 = '%%' OR lower(s.title || ' ' || s.brief || ' ' || s.notes || ' ' || r.sections::text) LIKE $1)
         AND ($2 IN ('all','songs') OR ($2 = 'starred' AND s.starred))
       ORDER BY s.updated_at DESC LIMIT 300`, [like, filter]);
    return { ideas, songs };
  }

  // ---------------- songs ----------------
  private async songThread(songId: string): Promise<string> {
    const [t] = await this.db.query<{ id: string }>(`SELECT id FROM threads WHERE song_id=$1`, [songId]);
    if (t) return t.id;
    const id = newId('t_');
    await this.db.query(`INSERT INTO threads(id, title, song_id) VALUES ($1,'',$2)`, [id, songId]);
    return id;
  }

  async createSong(input: { title?: string; text?: string; ideaId?: string | null; brief?: string; kind?: 'normal' | 'eval' }) {
    let title = (input.title ?? '').trim();
    let brief = input.brief ?? '';
    let sections: Section[] = parseLyrics(input.text ?? '');
    if (input.ideaId) {
      const [idea] = await this.db.query<{ title: string; concept: string; lines: Array<{ text: string }> }>(`SELECT title, concept, lines FROM ideas WHERE id=$1`, [input.ideaId]);
      if (!idea) throw new AppError(404, 'not_found', 'Idea not found.');
      title = title || idea.title;
      brief = idea.concept;
      if (!sections.length) sections = [{ id: newId('s_'), label: 'Seed', lines: idea.lines.map((l) => ({ id: newId('l_'), text: l.text })) }];
    }
    const id = newId('g_');
    await this.db.tx(async (q) => {
      await q(`INSERT INTO songs(id, title, brief, idea_id, motif, kind) VALUES ($1,$2,$3,$4,$5,$6)`, [id, title.slice(0, 200), brief, input.ideaId ?? null, motifFor(id), input.kind ?? 'normal']);
      await q(`INSERT INTO song_revisions(song_id, rev, sections, source, note) VALUES ($1,1,$2,'created',$3)`, [id, JSON.stringify(sections), input.ideaId ? 'Developed from a seed' : '']);
    });
    await this.songThread(id);
    return { id };
  }

  async song(id: string) {
    const [song] = await this.db.query<Record<string, unknown> & { current_rev: number }>(`SELECT * FROM songs WHERE id=$1`, [id]);
    if (!song) throw new AppError(404, 'not_found', 'Song not found.');
    const [rev] = await this.db.query<{ sections: Section[]; created_at: string }>(`SELECT sections, created_at FROM song_revisions WHERE song_id=$1 AND rev=$2`, [id, song.current_rev]);
    const threadId = await this.songThread(id);
    const idea = song.idea_id ? (await this.db.query(`SELECT id, title FROM ideas WHERE id=$1`, [song.idea_id]))[0] ?? null : null;
    return { ...song, sections: rev.sections, threadId, idea };
  }

  async revisions(id: string) {
    return this.db.query(`SELECT rev, source, note, created_at, sections FROM song_revisions WHERE song_id=$1 ORDER BY rev DESC LIMIT 200`, [id]);
  }

  async updateSong(id: string, patch: { title?: string; brief?: string; notes?: string; starred?: boolean; archived?: boolean; locks?: string[] }) {
    if (patch.locks && !(Array.isArray(patch.locks) && patch.locks.every((x) => typeof x === 'string'))) throw new AppError(400, 'bad_locks', 'Bad locks.');
    const rows = await this.db.query(
      `UPDATE songs SET title=COALESCE($2,title), brief=COALESCE($3,brief), notes=COALESCE($4,notes), starred=COALESCE($5,starred),
         archived=COALESCE($6,archived), locks=COALESCE($7,locks), updated_at=now() WHERE id=$1 RETURNING id`,
      [id, patch.title ?? null, patch.brief ?? null, patch.notes ?? null, patch.starred ?? null, patch.archived ?? null, patch.locks ? JSON.stringify(patch.locks) : null],
    );
    if (!rows.length) throw new AppError(404, 'not_found', 'Song not found.');
    return this.song(id);
  }

  /** Write a new immutable revision. Throws 409 if the base revision is stale. */
  private async commitRevision(songId: string, baseRev: number, build: (sections: Section[], locks: Set<string>, current: number, q: Db['query']) => Promise<Section[]> | Section[], source: string, note: string, runId: string | null = null) {
    return this.db.tx(async (q) => {
      const [song] = await q<{ current_rev: number; locks: string[] }>(`SELECT current_rev, locks FROM songs WHERE id=$1 FOR UPDATE`, [songId]);
      if (!song) throw new AppError(404, 'not_found', 'Song not found.');
      const [cur] = await q<{ sections: Section[] }>(`SELECT sections FROM song_revisions WHERE song_id=$1 AND rev=$2`, [songId, song.current_rev]);
      const locks = new Set(song.locks ?? []);
      const next = await build(cur.sections, locks, song.current_rev, q);
      if (renderLyrics(next) === renderLyrics(cur.sections) && JSON.stringify(next.map((s) => s.label)) === JSON.stringify(cur.sections.map((s) => s.label)))
        return { rev: song.current_rev, changed: false };
      const rev = song.current_rev + 1;
      await q(`INSERT INTO song_revisions(song_id, rev, sections, source, note, run_id) VALUES ($1,$2,$3,$4,$5,$6)`, [songId, rev, JSON.stringify(next), source, note, runId]);
      await q(`UPDATE songs SET current_rev=$2, updated_at=now() WHERE id=$1`, [songId, rev]);
      void baseRev;
      return { rev, changed: true };
    });
  }

  async saveText(songId: string, baseRev: number, text: string) {
    if (text.length > 30000) throw new AppError(400, 'too_long', 'That lyric is too long.');
    return this.commitRevision(songId, baseRev, (sections, locks, current) => {
      if (current !== baseRev) throw new AppError(409, 'conflict', 'This song changed somewhere else since you opened it. Your text is kept; reload to compare.', { currentRev: current });
      const next = reparsePreservingIds(sections, text);
      // Locked lines must survive a free-text edit unchanged.
      for (const id of locks) {
        const before = findLine(sections, id);
        const after = findLine(next, id);
        if (before && (!after || after.text !== before.text))
          throw new AppError(400, 'locked', `A locked line was changed or removed: “${before.text}”. Unlock it first.`);
      }
      return next;
    }, 'typed', '');
  }

  /** Accept a replacement set (from the writer or a direct edit). Safe rebase if only untouched lines moved on. */
  async accept(songId: string, baseRev: number, reps: Replacement[], source: 'direct' | 'writer', runId: string | null, note: string) {
    if (!Array.isArray(reps) || !reps.length) throw new AppError(400, 'empty', 'Nothing to apply.');
    return this.commitRevision(songId, baseRev, async (sections, locks, current, q) => {
      if (current !== baseRev) {
        const [base] = await q<{ sections: Section[] }>(`SELECT sections FROM song_revisions WHERE song_id=$1 AND rev=$2`, [songId, baseRev]);
        if (!base) throw new AppError(409, 'conflict', 'This suggestion was made for an older version.');
        for (const r of reps) {
          const a = findLine(base.sections, r.lineId), b = findLine(sections, r.lineId);
          if (!a || !b || a.text !== b.text)
            throw new AppError(409, 'conflict', 'You changed this line after asking for the suggestion, so it was not applied. Your newer text is kept.', { currentRev: current });
        }
      }
      try {
        return applyReplacements(sections, reps, locks);
      } catch (e) {
        if (e instanceof EditError) throw new AppError(e.code === 'locked' ? 400 : 409, e.code, e.message);
        throw e;
      }
    }, source === 'direct' ? 'edit:direct' : 'edit:writer', note, runId);
  }

  async acceptDraft(songId: string, baseRev: number, draft: Array<{ label: string; lines: string[] }>, runId: string | null) {
    const text = draft.map((s) => (s.label ? `[${s.label}]\n` : '') + s.lines.join('\n')).join('\n\n');
    return this.commitRevision(songId, baseRev, (sections, locks, current) => {
      if (current !== baseRev) throw new AppError(409, 'conflict', 'The song changed since this draft was written. Ask again to draft from the latest version.', { currentRev: current });
      const next = reparsePreservingIds(sections, text);
      for (const id of locks) {
        const before = findLine(sections, id), after = findLine(next, id);
        if (before && (!after || after.text !== before.text)) throw new AppError(400, 'locked', `This draft changes a locked line: “${before.text}”.`);
      }
      return next;
    }, 'draft', 'Used a full draft', runId);
  }

  async restore(songId: string, rev: number, baseRev: number) {
    const [old] = await this.db.query<{ sections: Section[] }>(`SELECT sections FROM song_revisions WHERE song_id=$1 AND rev=$2`, [songId, rev]);
    if (!old) throw new AppError(404, 'not_found', 'Version not found.');
    return this.commitRevision(songId, baseRev, (_s, _l, current) => {
      if (current !== baseRev) throw new AppError(409, 'conflict', 'The song changed since you opened history. Reload and try again.');
      return old.sections;
    }, 'restore', `Restored version ${rev}`);
  }

  async deleteSong(id: string) {
    await this.db.query(`UPDATE runs SET status='cancelled' WHERE song_id=$1 AND status='running'`, [id]);
    await this.db.query(`DELETE FROM threads WHERE song_id=$1`, [id]);
    await this.db.query(`DELETE FROM songs WHERE id=$1`, [id]);
  }

  // ---------------- edits ----------------
  async edit(songId: string, input: { baseRev: number; targets: Target[]; instruction: string; clientKey: string | null; count?: number }) {
    const instruction = input.instruction.trim();
    if (!instruction) throw new AppError(400, 'empty', 'Say what should change.');
    const ctx = await this.songContext(songId);
    if (ctx.rev !== input.baseRev) throw new AppError(409, 'conflict', 'The song changed since you selected this. Reselect and try again.', { currentRev: ctx.rev });
    const locks = new Set(ctx.locks);
    let targets: Target[];
    try {
      targets = resolveTargets(ctx.sections, input.targets ?? [], locks);
    } catch (e) {
      if (e instanceof EditError) throw new AppError(409, e.code, e.message);
      throw e;
    }
    const threadId = await this.songThread(songId);
    const selectionText = describeSelection(ctx.sections, targets);

    // 1) Literal, unambiguous replacements are done directly — no writer, no cost.
    const literal = parseLiteral(instruction);
    if (literal) {
      const reps = literalReplacements(ctx.sections, targets.length ? targets : null, literal.from, literal.to, locks);
      const payload = {
        kind: 'edit', direct: true as const, baseRev: ctx.rev, instruction,
        note: reps.length ? `Direct edit: “${literal.from}” → “${literal.to}”. No writer used.` : `Couldn't find “${literal.from}” ${targets.length ? 'in your selection' : 'in unlocked lines'}.`,
        options: reps.length ? [{ key: `direct:${newId('k_')}`, replacements: reps, diff: diffFor(ctx.sections, reps), checks: [] }] : [],
      };
      await this.logEditMessages(threadId, instruction, selectionText, null, payload);
      return payload;
    }

    if (!targets.length) throw new AppError(400, 'no_selection', 'Select the words or lines to change first. To talk about the whole song, use the chat below.');

    // 2) Writer-assisted targeted edit.
    const annotated = annotate(ctx.sections, targets, locks);
    const targetDescs = targets.map((t, i) => {
      const line = findLine(ctx.sections, t.lineId)!;
      return {
        id: `T${i + 1}`,
        describe: t.kind === 'line'
          ? `the whole line “${line.text}”`
          : `only the words “${t.expected}” in the line “${line.text}” (keep “${line.text.slice(0, t.start)}” before and “${line.text.slice(t.end)}” after)`,
      };
    });
    const det = extractConstraints(instruction);
    const count = Math.min(Math.max(input.count ?? det.count ?? 3, 1), 8);
    const turns = await this.recentTurns(threadId);
    const taste = await this.tasteFor(instruction);
    const system = SYSTEM_CORE + (taste ? `\n\n${taste}` : '');
    const user = editPrompt({ request: instruction, song: ctx, annotated, targets: targetDescs, count, turns });
    const s = await this.settings();
    const userMsgId = newId('m_');
    await this.db.query(`INSERT INTO messages(id, thread_id, role, text, payload) VALUES ($1,$2,'user',$3,$4)`,
      [userMsgId, threadId, instruction, JSON.stringify({ selection: selectionText, edit: true })]);
    const run = await this.startRun({
      task: 'edit', threadId, songId, clientKey: input.clientKey, effort: s.effortEdit,
      request: { instruction, baseRev: ctx.rev, targets }, inputChars: system.length + user.length,
      exec: async (signal, model) => {
        const r = await this.call('edit', system, user, editSchema, s.effortEdit, signal, model);
        const parsed = editZ.safeParse(r.json);
        if (!parsed.success) throw new WriterError('bad_output', 'The writer returned an unexpected shape.', r.usage);
        return { result: shapeEdit(parsed.data, det, ctx.sections, targets, ctx.rev, instruction), usage: r.usage, requestId: r.requestId, model: r.model, live: r.live };
      },
      onSuccess: async (runId, result) => {
        await this.db.query(`INSERT INTO messages(id, thread_id, role, text, run_id, payload) VALUES ($1,$2,'assistant',$3,$4,$5)`,
          [newId('m_'), threadId, String(result.reply ?? ''), runId, JSON.stringify(result)]);
      },
    });
    return { direct: false as const, runId: run.id, threadId };
  }

  private async logEditMessages(threadId: string, instruction: string, selection: string, runId: string | null, payload: Record<string, unknown>) {
    await this.db.query(`INSERT INTO messages(id, thread_id, role, text, payload) VALUES ($1,$2,'user',$3,$4)`,
      [newId('m_'), threadId, instruction, JSON.stringify({ selection, edit: true })]);
    await this.db.query(`INSERT INTO messages(id, thread_id, role, text, run_id, payload) VALUES ($1,$2,'assistant',$3,$4,$5)`,
      [newId('m_'), threadId, '', runId, JSON.stringify(payload)]);
  }

  // ---------------- Suno ----------------
  async suno(songId: string, input: { hint: string; clientKey: string | null }) {
    const ctx = await this.songContext(songId);
    const lines = allLines(ctx.sections);
    if (!lines.length) throw new AppError(400, 'empty', 'Add some lyrics before building a Suno prompt.');
    const sections = ctx.sections.map((sec, index) => ({ index, label: sec.label, text: sec.lines.map((l) => l.text).join('\n') }));
    const s = await this.settings();
    const system = SYSTEM_CORE;
    const user = sunoPrompt({ song: ctx, sections, hint: input.hint ?? '', taste: s.taste });
    const run = await this.startRun({
      task: 'suno', threadId: null, songId, clientKey: input.clientKey, effort: s.effortEdit,
      request: { hint: input.hint, rev: ctx.rev }, inputChars: system.length + user.length,
      exec: async (signal, model) => {
        const r = await this.call('suno', system, user, sunoSchema, s.effortEdit, signal, model);
        const parsed = sunoZ.safeParse(r.json);
        if (!parsed.success) throw new WriterError('bad_output', 'The writer returned an unexpected shape.', r.usage);
        return { result: assembleSuno(parsed.data, ctx.sections, ctx.title, ctx.rev, input.hint ?? ''), usage: r.usage, requestId: r.requestId, model: r.model, live: r.live };
      },
      onSuccess: async (_runId, result) => {
        await this.db.query(`UPDATE songs SET suno=$2, updated_at=now() WHERE id=$1`, [songId, JSON.stringify(result)]);
      },
    });
    return { runId: run.id };
  }

  // ---------------- export ----------------
  async exportAll() {
    const tables = ['settings', 'threads', 'messages', 'runs', 'ideas', 'songs', 'song_revisions', 'voice_examples', 'eval_results'];
    const out: Record<string, unknown> = { format: 'songroom-backup', version: 1, exportedAt: new Date().toISOString() };
    for (const t of tables) out[t] = await this.db.query(`SELECT * FROM ${t}`);
    return out;
  }

  async exportMarkdown(): Promise<string> {
    const ideas = await this.db.query<{ kind: string; title: string; concept: string; lines: Array<{ text: string }>; notes: string; starred: boolean; created_at: string }>(
      `SELECT kind, title, concept, lines, notes, starred, created_at FROM ideas WHERE NOT archived ORDER BY created_at`);
    const songs = await this.db.query<{ id: string; title: string; brief: string; notes: string; current_rev: number }>(`SELECT id, title, brief, notes, current_rev FROM songs WHERE NOT archived AND kind='normal' ORDER BY created_at`);
    let md = `# Songroom journal\n\nExported ${new Date().toISOString().slice(0, 10)}\n\n## Songs\n\n`;
    for (const s of songs) {
      const [r] = await this.db.query<{ sections: Section[] }>(`SELECT sections FROM song_revisions WHERE song_id=$1 AND rev=$2`, [s.id, s.current_rev]);
      md += `### ${s.title || 'Untitled'}\n\n${s.brief ? `_${s.brief}_\n\n` : ''}\`\`\`\n${renderLyrics(r.sections)}\n\`\`\`\n\n${s.notes ? `Notes: ${s.notes}\n\n` : ''}`;
    }
    md += `## Seeds and lines\n\n`;
    for (const i of ideas) {
      md += `### ${i.starred ? '★ ' : ''}${i.title || (i.kind === 'line' ? 'Line' : 'Untitled')}\n\n${i.concept ? `${i.concept}\n\n` : ''}${i.lines.map((l) => `> ${l.text}`).join('\n')}\n\n${i.notes ? `Notes: ${i.notes}\n\n` : ''}`;
    }
    return md;
  }
}

// ---------------- helpers ----------------

function titleFrom(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 70 ? t.slice(0, 67) + '…' : t;
}

export function motifFor(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 8;
}

function compactMessage(text: string, payload: Record<string, unknown> | null): string {
  if (!payload) return text;
  const parts: string[] = [];
  if (text) parts.push(text);
  if (payload.selection) parts.push(`(about: ${payload.selection})`);
  const ideas = (payload.ideas as Array<{ title: string; concept: string; lines: string[] }> | undefined) ?? [];
  ideas.forEach((i, n) => parts.push(`Idea ${n + 1}: “${i.title}” — ${i.concept} / ${i.lines.join(' / ')}`));
  const options = (payload.options as Array<{ lines?: string[]; diff?: Array<{ after: string }> }> | undefined) ?? [];
  options.forEach((o, n) => parts.push(`Option ${n + 1}: ${(o.lines ?? o.diff?.map((d) => d.after) ?? []).join(' / ')}`));
  const draft = payload.draft as { sections: Array<{ label: string; lines: string[] }> } | null | undefined;
  if (draft) parts.push(`Draft: ${draft.sections.map((s) => `[${s.label}] ${s.lines.join(' / ')}`).join(' ')}`);
  return parts.join('\n').slice(0, 2500);
}

function shapeWrite(out: ReturnType<typeof writeZ.parse>, det: Partial<Constraints>) {
  const c = mergeConstraints(out.constraints, det);
  const ideas = out.ideas.map((i) => ({ ...i, lines: i.lines.filter((l) => l.trim()), checks: checkCandidate(i.lines, { ...c, mustEndWith: null, mustStartWith: null }, { checkLineCount: true }) }));
  const options = out.options.map((o) => ({ lines: o.lines, checks: checkCandidate(o.lines, c, { checkLineCount: true }) }));
  const summary: Check[] = [];
  const n = out.kind === 'ideas' ? ideas.length : out.kind === 'lines' ? options.length : null;
  if (c.count && n !== null) summary.push({ label: `${c.count} requested`, ok: n === c.count });
  return { kind: out.kind, reply: out.reply, ideas, options, draft: out.draft, constraints: c, checks: summary };
}

function shapeEdit(out: ReturnType<typeof editZ.parse>, det: Partial<Constraints>, sections: Section[], targets: Target[], baseRev: number, instruction: string) {
  const c = mergeConstraints(out.constraints, det);
  const options = out.options.map((o, idx) => {
    const byTarget = new Map(o.targets.map((t) => [t.target.trim().toUpperCase(), t.text]));
    const proposals = targets.map((_, i) => byTarget.get(`T${i + 1}`));
    if (proposals.some((p) => p === undefined) || o.targets.length !== targets.length)
      return { key: `o${idx}`, invalid: 'This option did not cover exactly the selected text, so it was discarded.', replacements: [], diff: [], checks: [] };
    let reps: Replacement[];
    try {
      reps = buildReplacements(sections, targets, proposals as string[]);
    } catch (e) {
      return { key: `o${idx}`, invalid: e instanceof EditError ? e.message : 'Invalid option.', replacements: [], diff: [], checks: [] };
    }
    const changed = reps.map((r) => r.newText);
    const checks: Check[] = [];
    if (c.mustEndWith) checks.push({ label: `ends “${c.mustEndWith}”`, ok: endsWithPhrase(changed[changed.length - 1] ?? '', c.mustEndWith) });
    if (c.mustStartWith) checks.push({ label: `starts “${c.mustStartWith}”`, ok: startsWithPhrase(changed[0] ?? '', c.mustStartWith) });
    for (const w of c.forbidden) if ((proposals as string[]).some((p) => containsWord(p, w))) checks.push({ label: `avoids “${w}”`, ok: false });
    const unchanged = reps.every((r) => findLine(sections, r.lineId)!.text === r.newText);
    if (unchanged) checks.push({ label: 'changes something', ok: false });
    return { key: `o${idx}`, replacements: reps, diff: diffFor(sections, reps), checks };
  });
  return { kind: 'edit', direct: false, reply: out.reply, baseRev, instruction, options, constraints: c };
}

function diffFor(sections: Section[], reps: Replacement[]) {
  return reps.map((r) => ({ lineId: r.lineId, before: findLine(sections, r.lineId)?.text ?? '', after: r.newText }));
}

function describeSelection(sections: Section[], targets: Target[]): string {
  return targets.map((t) => (t.kind === 'span' ? `“${t.expected}” in “${findLine(sections, t.lineId)?.text}”` : `“${t.expected}”`)).join('; ');
}

function annotate(sections: Section[], targets: Target[], locks: Set<string>): string {
  const spans = new Map(targets.filter((t) => t.kind === 'span').map((t) => [t.lineId, t as Extract<Target, { kind: 'span' }>]));
  const whole = new Set(targets.filter((t) => t.kind === 'line').map((t) => t.lineId));
  return sections.map((s) => {
    const body = s.lines.map((l) => {
      let text = l.text;
      const sp = spans.get(l.id);
      if (sp) text = text.slice(0, sp.start) + '⟦' + text.slice(sp.start, sp.end) + '⟧' + text.slice(sp.end);
      else if (whole.has(l.id)) text = '⟦' + text + '⟧';
      return (locks.has(l.id) ? '🔒 ' : '') + text;
    }).join('\n');
    return (s.label ? `[${s.label}]\n` : '') + body;
  }).join('\n\n');
}

const TAG_RE = /^\[[^\[\]\n]{1,160}\]$/;

export function assembleSuno(out: ReturnType<typeof sunoZ.parse>, sections: Section[], title: string, rev: number, hint: string) {
  const clean = (tags: string[]) => tags.map((t) => t.trim()).filter((t) => TAG_RE.test(t));
  const parts: string[] = [];
  const intro = clean(out.intro);
  if (intro.length) parts.push(intro.join('\n'));
  sections.forEach((sec, i) => {
    let tags = clean(out.sections.find((x) => x.index === i)?.tags ?? []);
    if (!tags.length) tags = [`[${sec.label || 'Verse'}]`];
    parts.push([...tags, ...sec.lines.map((l) => l.text)].join('\n'));
  });
  let outro = clean(out.outro);
  if (!outro.length || outro[outro.length - 1].toLowerCase() !== '[end]') outro = [...outro, '[End]'];
  parts.push(outro.join('\n'));
  const lyrics = parts.join('\n\n');
  const style = out.style.replace(/\s+/g, ' ').trim();
  const warnings: string[] = [];
  if (style.length > 1000) warnings.push(`Style is ${style.length} characters; Suno's limit is about 1000.`);
  if (lyrics.length > 5000) warnings.push(`Lyrics with tags are ${lyrics.length} characters; Suno's limit is 5000.`);
  return { title, style, exclude: out.exclude.trim(), lyrics, rev, hint, warnings, createdAt: new Date().toISOString() };
}
