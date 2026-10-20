// The research test (19 Oct 2026 commission, Phase E): real briefs from Sam's own sessions,
// each written twice by the production prompt, once with no research and once with at most two
// craft cards chosen for that action. Cards are the only thing that differs: the same frozen
// system prompt (taste, lessons), the same references, the same engine-chosen subjects and
// title placements, the same model, effort and number of candidates.
//
// Everything is fixed when the batch is created: the exact prompts, which output is A and which
// is B (balanced across the set), and the order. Nothing is reshuffled while he reads or comes
// back. Votes keep their history with timestamps; ties ("both"), "neither" and "skip" are
// separate. Which output had research is shown only when every trial has a verdict.

import type { Db } from './db.js';
import { Service, AppError, annotate, diffFor, shapeWrite, MAX_TOKENS, type CraftRecord } from './service.js';
import type { Studio } from './studio.js';
import {
  systemCore, PROMPT_VERSION, IDEA_TEMPLATE, WORKSPACE_TEMPLATE, sparkPromptV2, reworkPrompt, writePrompt, suggestPrompt, titlesPrompt,
  contextBlock, referenceBlock, referenceLines, type WorkspaceContext,
} from './engine/prompts.js';
import { sparkSchema, sparkZ, reworkSchema, reworkZ, writeSchema, writeZ, suggestReplaceSchema, suggestReplaceZ, suggestAddSchema, suggestAddZ, titlesSchema, titlesZ } from './engine/schemas.js';
import { SUBJECTS, GENRES, genreFor, pickSubjects, shapeNote, hitConceptsNote } from './engine/barometer.js';
import { HOOK_NOTE, assignHooks, type Hook } from './engine/hook.js';
import { extractConstraints, mergeConstraints, containsWord, endsWithPhrase, startsWithPhrase, syllables, type Check } from './engine/validate.js';
import { findLine, renderLyrics, buildReplacements, newId, type Section, type Target } from './engine/lyrics.js';
import { WriterError, type Usage } from './engine/writer.js';
import { inferTask, type Route } from './engine/pack.js';

export type TrialCase =
  | { id: string; route: 'ideas'; direction: string; genre: string; refId?: string | null }
  | { id: string; route: 'develop'; ideaId: string; feedback: string; keepTitle: boolean; keepConcept: boolean; keepLineIds: string[]; changeLineIds: string[] }
  | { id: string; route: 'create'; text: string; refId?: string | null }
  | { id: string; route: 'rewrite' | 'continue'; setId: string }
  | { id: string; route: 'title'; songId: string; ask: string };

type Kind = 'spark' | 'rework' | 'write' | 'suggest_replace' | 'suggest_add' | 'titles';
/** Everything a generation needs, frozen at creation. */
export type Frozen = {
  route: Route; kind: Kind; system: string; user: { off: string; on: string }; effort: string; maxTokens: number;
  research: CraftRecord; promptVersion: string;
  hooks?: Hook[]; // ideas: the engine's title placements, checked the same way as production
  keep?: { title: string | null; lines: string[]; original: string[] }; // develop: what he kept comes back exactly
  sections?: Section[]; targets?: Target[]; constraints?: ReturnType<typeof extractConstraints>; // rewrite/continue/create checks
};
export type Shown = { label: string; context: string[] };
export type Output =
  | { kind: 'ideas'; ideas: Array<{ title: string; concept: string; lines: string[] }>; checks: Check[]; note: string }
  | { kind: 'lines'; options: Array<{ lines: string[]; checks: Check[] }>; note: string }
  | { kind: 'replace'; options: Array<{ before: string; after: string; checks: Check[] }>; note: string }
  | { kind: 'titles'; titles: Array<{ title: string; lines: string[]; why: string }>; note: string }
  | { kind: 'draft'; sections: Array<{ label: string; lines: string[] }>; note: string }
  | { kind: 'reply'; text: string };
export type Verdict = { pick: 'A' | 'B' | 'both' | 'neither' | 'skip'; spark: { A: boolean; B: boolean }; note: string; at: string };

type TrialRow = {
  id: string; batch: string; ord: number; case_id: string; route: Route; shown: Shown; frozen: Frozen; a_cond: 'off' | 'on';
  outputs: { off?: Output; on?: Output; offError?: string; onError?: string } | null; run_ids: { off?: string; on?: string } | null;
  verdict: Verdict | null; verdicts: Verdict[]; seen_at: string | null; created_at: string;
};

/** A seeded shuffle, so a batch's order and A/B assignment can be reproduced from its seed. */
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }
function shuffle<T>(xs: T[], r: () => number): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const IDEA_SIDE: Route[] = ['ideas', 'develop'];

export class Trials {
  private db: Db;
  constructor(private svc: Service, private studio: Studio) { this.db = svc.db; }

  // ------------------------------------------------------------------ freezing one case
  async freeze(c: TrialCase): Promise<{ frozen: Frozen; shown: Shown }> {
    const s = await this.svc.settings();
    const choice = { mode: 'cards' as const, maxCards: 2 };
    if (c.route === 'ideas') {
      const refs = c.refId ? await this.studio.refsForPrompt([c.refId]) : [];
      const genre = genreFor(c.genre, c.direction);
      const subjects = pickSubjects(genre, 3, []);
      const hooks = assignHooks(3);
      const taste = await this.svc.tasteFor(c.direction);
      const system = systemCore(PROMPT_VERSION) + (taste ? `\n\n${taste}` : '');
      const craft = await this.svc.research('ideas', { text: c.direction || 'song ideas', reference: refs.map((r) => r.name).join(', ') || null, task: 'ideas' }, { choice });
      const hit = hitConceptsNote('all'); // sampled once: both conditions see the same examples
      const user = (block: string) => sparkPromptV2({
        direction: c.direction, genreLabel: GENRES.find((g) => g.id === genre)?.label ?? 'Pop', references: referenceBlock(refs),
        avoidTitles: [], subjects: subjects.map((k) => SUBJECTS[k]), hooks: hooks.map((h) => HOOK_NOTE[h]), shape: shapeNote(genre), craft: block,
        hitConcepts: hit,
      });
      return {
        frozen: { route: 'ideas', kind: 'spark', system, user: { off: user(''), on: user(craft.block) }, effort: s.effortCreative, maxTokens: MAX_TOKENS.spark, research: craft.record!, promptVersion: `${PROMPT_VERSION}/${IDEA_TEMPLATE}`, hooks },
        shown: { label: 'Ideas screen: three ideas', context: [`Direction: ${c.direction || '(none)'}`, `Genre: ${GENRES.find((g) => g.id === genre)?.label ?? genre}`, ...(refs.length ? [`Reference: ${refs.map((r) => r.name).join(', ')}`] : [])] },
      };
    }
    if (c.route === 'develop') {
      const [idea] = await this.db.query<{ title: string; concept: string; lines: Array<{ id: string; text: string }> }>(`SELECT title, concept, lines FROM ideas WHERE id=$1`, [c.ideaId]);
      if (!idea) throw new AppError(404, 'not_found', `Idea ${c.ideaId} not found.`);
      const direction = await this.studio.direction();
      const keepLines = idea.lines.filter((l) => c.keepLineIds.includes(l.id));
      const changeLines = idea.lines.filter((l) => c.changeLineIds.includes(l.id) && !c.keepLineIds.includes(l.id));
      const taste = await this.svc.tasteFor(direction.text);
      const system = systemCore(PROMPT_VERSION) + (taste ? `\n\n${taste}` : '');
      const lessons = await this.svc.lessons.list();
      const craft = await this.svc.research('develop', { text: c.feedback || idea.title, brief: idea.concept, reference: null }, { choice });
      // the direction at the time was empty with no reference; frozen as such
      const user = (block: string) => reworkPrompt({
        idea: { title: idea.title, concept: idea.concept, lines: idea.lines.map((l) => l.text) },
        feedback: c.feedback, keepTitle: c.keepTitle, keepConcept: c.keepConcept,
        keepLines: keepLines.map((l) => l.text), changeLines: changeLines.map((l) => l.text),
        direction: '', shape: shapeNote(genreFor(undefined, '')), references: '', lessons: lessons.map((l) => l.text), craft: block,
      });
      return {
        frozen: { route: 'develop', kind: 'rework', system, user: { off: user(''), on: user(craft.block) }, effort: s.effortCreative, maxTokens: MAX_TOKENS.rework, research: craft.record!, promptVersion: `${PROMPT_VERSION}/${IDEA_TEMPLATE}`,
          keep: { title: c.keepTitle ? idea.title : null, lines: keepLines.map((l) => l.text), original: idea.lines.map((l) => l.text) } },
        shown: { label: 'Develop an idea: one reworked idea', context: [`The idea: “${idea.title}”. ${idea.concept}`, ...idea.lines.map((l) => `   ${keepLines.some((k) => k.id === l.id) ? '(kept) ' : ''}${l.text}`), `His note: ${c.feedback}`, ...(c.keepTitle ? ['He kept the title.'] : [])] },
      };
    }
    if (c.route === 'create') {
      const refs = c.refId ? await this.studio.refsForPrompt([c.refId]) : [];
      const taste = await this.svc.tasteFor(c.text + ' ' + refs.map((r) => r.name).join(', '));
      const system = systemCore(PROMPT_VERSION) + (taste ? `\n\n${taste}` : '');
      const det = extractConstraints(c.text);
      const craft = await this.svc.research('create', { text: c.text, reference: refs.map((r) => r.name).join(', ') || null, task: inferTask(c.text, false) }, { choice });
      const hit = /\b(idea|ideas|title|titles|concept|concepts|hook)\b/i.test(c.text) ? hitConceptsNote('all') : '';
      const user = (block: string) => writePrompt({ request: c.text, reference: referenceLines(refs) || null, turns: [], song: null, focus: null, craft: block, variant: PROMPT_VERSION, hitConcepts: hit });
      return {
        frozen: { route: 'create', kind: 'write', system, user: { off: user(''), on: user(craft.block) }, effort: s.effortCreative, maxTokens: MAX_TOKENS.write, research: craft.record!, promptVersion: PROMPT_VERSION, constraints: det },
        shown: { label: 'Create: one result', context: [`His brief: ${c.text}`, ...(refs.length ? [`Reference: ${refs.map((r) => r.name).join(', ')}`] : [])] },
      };
    }
    if (c.route === 'rewrite' || c.route === 'continue') {
      const [set] = await this.db.query<{ song_id: string; base_rev: number; mode: string; targets: { targets: Target[]; afterLineId: string | null }; instruction: string; context: Record<string, any> }>(
        `SELECT song_id, base_rev, mode, targets, instruction, context FROM suggestion_sets WHERE id=$1`, [c.setId]);
      if (!set) throw new AppError(404, 'not_found', `Suggestion set ${c.setId} not found.`);
      const [song] = await this.db.query<{ title: string; brief: string; locks: string[] }>(`SELECT title, brief, locks FROM songs WHERE id=$1`, [set.song_id]);
      const [rev] = await this.db.query<{ sections: Section[] }>(`SELECT sections FROM song_revisions WHERE song_id=$1 AND rev=$2`, [set.song_id, set.base_rev]);
      const sections = rev.sections;
      const ctx = { title: song.title, brief: song.brief, lyrics: renderLyrics(sections) };
      const locks = new Set(song.locks ?? []);
      const targets = set.targets.targets ?? [];
      const mode: 'replace' | 'add' = c.route === 'rewrite' ? 'replace' : 'add';
      const sc = set.context ?? {};
      const rhymeLine = sc.rhyme?.mode === 'linked' && sc.rhyme.lineId ? findLine(sections, sc.rhyme.lineId)?.text : undefined;
      const wctx: WorkspaceContext = { meaning: sc.meaning ?? '', narrator: sc.narrator ?? '', rhyme: sc.rhyme?.word ? { word: sc.rhyme.word, mode: sc.rhyme.mode, line: rhymeLine } : null, rhythm: sc.rhythm?.sample ? { sample: sc.rhythm.sample, syllables: syllables(sc.rhythm.sample) } : null };
      const refs = await this.studio.refsForPrompt(sc.refIds ?? []);
      const targetDescs = targets.map((t, i) => {
        const line = findLine(sections, t.lineId)!;
        return { id: `T${i + 1}`, describe: t.kind === 'line' ? `the whole line “${line.text}”` : `only the words “${t.expected}” in the line “${line.text}” (keep “${line.text.slice(0, t.start)}” before and “${line.text.slice(t.end)}” after)` };
      });
      const taste = await this.svc.tasteFor(set.instruction);
      const system = systemCore(PROMPT_VERSION) + (taste ? `\n\n${taste}` : '');
      const craft = await this.svc.research(c.route, { text: set.instruction, brief: song.brief, reference: refs.map((r) => r.name).join(', ') || null, task: mode === 'replace' ? 'edit' : 'lines' }, { choice });
      const afterLineId = set.targets.afterLineId;
      const user = (block: string) => suggestPrompt({
        mode, song: ctx, annotated: annotate(sections, targets, locks), targets: targetDescs,
        insertAfter: afterLineId ? findLine(sections, afterLineId)!.text : null, instruction: set.instruction,
        context: contextBlock(wctx), references: referenceBlock(refs), avoid: [], count: 4, craft: block,
      });
      const where = mode === 'replace' ? `Selected: “${targets.map((t) => t.expected).join(' / ')}”` : `New lines after: “${afterLineId ? findLine(sections, afterLineId)!.text : 'the end'}”`;
      return {
        frozen: { route: c.route, kind: mode === 'replace' ? 'suggest_replace' : 'suggest_add', system, user: { off: user(''), on: user(craft.block) }, effort: s.effortEdit, maxTokens: MAX_TOKENS.suggest, research: craft.record!, promptVersion: `${PROMPT_VERSION}/${WORKSPACE_TEMPLATE}`, sections, targets, constraints: extractConstraints(set.instruction) },
        shown: { label: mode === 'replace' ? 'Journal: rewrite a line (four options)' : 'Journal: continue the song (four options)', context: [`Song: “${song.title}”`, ctx.lyrics, where, `His instruction: ${set.instruction}`, ...(refs.length ? [`Reference: ${refs.map((r) => r.name).join(', ')}`] : [])] },
      };
    }
    // title
    if (c.route !== 'title') throw new AppError(400, 'bad_case', 'Unknown route.');
    const ws = await this.studio.workspace(c.songId) as unknown as Record<string, any>;
    const lyrics = renderLyrics(ws.sections);
    const onPage = [...(ws.idea?.lines.map((l: { text: string }) => l.text) ?? []), ...ws.scraps.map((f: { text: string }) => f.text)].filter((t: string) => !lyrics.includes(t)).slice(-30);
    const refs = await this.studio.refsForPrompt(ws.context.refs.map((r: { id: string }) => r.id));
    const direction = await this.studio.direction();
    if (!refs.length && direction.refId) refs.push(...(await this.studio.refsForPrompt([direction.refId])));
    const taste = await this.svc.tasteFor(`${c.ask} ${String(ws.title ?? '')}`);
    const system = systemCore(PROMPT_VERSION) + (taste ? `\n\n${taste}` : '');
    const craft = await this.svc.research('title', { text: c.ask || 'a title for the next section', brief: String(ws.brief ?? ''), reference: refs.map((r) => r.name).join(', ') || null }, { choice });
    const hit = hitConceptsNote('all'); // sampled once: both conditions see the same examples
    const user = (block: string) => titlesPrompt({
      title: String(ws.title ?? ''), brief: String(ws.brief ?? ''), lyrics, onPage, ask: c.ask, references: referenceBlock(refs),
      context: contextBlock({ meaning: ws.context.meaning, narrator: ws.context.narrator, rhyme: null, rhythm: null }), avoid: [], hitConcepts: hit, craft: block,
    });
    return {
      frozen: { route: 'title', kind: 'titles', system, user: { off: user(''), on: user(craft.block) }, effort: s.effortCreative, maxTokens: MAX_TOKENS.titles, research: craft.record!, promptVersion: `${PROMPT_VERSION}/${IDEA_TEMPLATE}` },
      shown: { label: 'Journal: find the title (eight titles)', context: [`Song: “${String(ws.title ?? '') || 'untitled'}”`, lyrics, `His ask: ${c.ask}`] },
    };
  }

  // ------------------------------------------------------------------ a batch
  /** Freeze every case, fix the order and the A/B sides (balanced within the Ideas side and the lyric side), then generate. */
  async create(input: { name: string; cases: TrialCase[]; seed?: number; repeatOf?: string }) {
    const seed = input.seed ?? Math.floor(Math.random() * 2 ** 31);
    const r = rng(seed);
    const batch = newId('tb_');
    const frozen: Array<{ c: TrialCase; frozen: Frozen; shown: Shown }> = [];
    if (input.repeatOf) {
      // a repeat: the same frozen prompts, generated again, with the sides flipped
      const prev = await this.db.query<TrialRow>(`SELECT * FROM trials WHERE batch=$1 ORDER BY ord`, [input.repeatOf]);
      const want = new Set(input.cases.map((c) => c.id));
      for (const p of prev) if (!want.size || want.has(p.case_id)) frozen.push({ c: { id: p.case_id } as TrialCase, frozen: p.frozen, shown: p.shown });
      if (!frozen.length) throw new AppError(400, 'empty', 'Nothing to repeat.');
      const flip = new Map(prev.map((p) => [p.case_id, p.a_cond === 'on' ? 'off' : 'on'] as const));
      for (const [i, f] of shuffle(frozen, r).entries()) await this.insert(batch, i, f, flip.get(f.c.id) as 'off' | 'on', input.name, seed, input.repeatOf);
    } else {
      for (const c of input.cases) frozen.push({ c, ...(await this.freeze(c)) });
      const sides = new Map<string, 'off' | 'on'>();
      for (const group of [frozen.filter((f) => IDEA_SIDE.includes(f.frozen.route)), frozen.filter((f) => !IDEA_SIDE.includes(f.frozen.route))]) {
        const order = shuffle(group, r);
        order.forEach((f, i) => sides.set(f.c.id, i % 2 === 0 ? 'on' : 'off'));
      }
      for (const [i, f] of shuffle(frozen, r).entries()) await this.insert(batch, i, f, sides.get(f.c.id)!, input.name, seed, null);
    }
    this.svc.track(this.generateAll(batch));
    return this.batch(batch);
  }

  private async insert(batch: string, ord: number, f: { c: TrialCase; frozen: Frozen; shown: Shown }, aCond: 'off' | 'on', name: string, seed: number, repeatOf: string | null) {
    await this.db.query(`INSERT INTO trials(id, batch, batch_name, seed, repeat_of, ord, case_id, route, shown, frozen, a_cond) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [newId('tr_'), batch, name, seed, repeatOf, ord, f.c.id, f.frozen.route, JSON.stringify(f.shown), JSON.stringify(f.frozen), aCond]);
  }

  /** One trial at a time, its two outputs side by side, so a failure costs at most one pair. */
  async generateAll(batch: string) {
    const rows = await this.db.query<TrialRow>(`SELECT * FROM trials WHERE batch=$1 ORDER BY ord`, [batch]);
    for (const t of rows) {
      if (t.outputs?.off && t.outputs?.on) continue;
      await Promise.all((['off', 'on'] as const).map((cond) => this.generate(t, cond).catch(() => null)));
    }
  }

  private async generate(t: TrialRow, cond: 'off' | 'on') {
    const f = t.frozen;
    const schema = { spark: sparkSchema, rework: reworkSchema, write: writeSchema, suggest_replace: suggestReplaceSchema, suggest_add: suggestAddSchema, titles: titlesSchema }[f.kind];
    const writer = this.svc.writer;
    if (!writer) throw new AppError(503, 'no_writer', 'No writer is connected.');
    const user = f.user[cond];
    let out: Output | null = null;
    const run = await this.svc.startRun({
      task: 'trial', threadId: null, songId: null, clientKey: `trial:${t.id}:${cond}`, effort: f.effort as never,
      promptVersion: `${f.promptVersion}${cond === 'on' ? '+cards' : ''}`,
      request: { trial: t.id, batch: t.batch, case: t.case_id, route: f.route, condition: cond, pack: cond === 'on' ? f.research : { ...f.research, mode: 'off', cards: [], reasons: [], block: '', hash: '' } },
      inputChars: f.system.length + user.length,
      exec: async (signal, model) => {
        const r = await writer.write({ system: f.system, user, schema, effort: f.effort as never, maxTokens: f.maxTokens, model, signal });
        let usage: Usage = r.usage;
        out = await this.shape(f, r.json, signal, model, (u) => { usage = { inputTokens: usage.inputTokens + u.inputTokens, outputTokens: usage.outputTokens + u.outputTokens, cacheReadTokens: usage.cacheReadTokens + u.cacheReadTokens, cacheWriteTokens: usage.cacheWriteTokens + u.cacheWriteTokens }; });
        return { result: out as unknown as Record<string, unknown>, usage, requestId: r.requestId, model: r.model, live: r.live };
      },
      onSuccess: async () => {},
    });
    await this.db.query(`UPDATE trials SET run_ids=json_set(COALESCE(run_ids,'{}'), '$.${cond}', $2) WHERE id=$1`, [t.id, run.id]);
    const final = await this.waitRun(run.id);
    if (final.status === 'succeeded') await this.db.query(`UPDATE trials SET outputs=json_set(COALESCE(outputs,'{}'), '$.${cond}', json($2)) WHERE id=$1`, [t.id, JSON.stringify(final.result)]);
    else await this.db.query(`UPDATE trials SET outputs=json_set(COALESCE(outputs,'{}'), '$.${cond}Error', $2) WHERE id=$1`, [t.id, String((final.error as { message?: string } | null)?.message ?? final.status)]);
  }

  private async waitRun(id: string): Promise<{ status: string; result: unknown; error: unknown }> {
    for (;;) {
      const [r] = await this.db.query<{ status: string; result: unknown; error: unknown }>(`SELECT status, result, error FROM runs WHERE id=$1`, [id]);
      if (r && r.status !== 'running') return r;
      await new Promise((res) => setTimeout(res, 400));
    }
  }

  /** The same post-processing production applies, so what he judges is what he would have seen. */
  private async shape(f: Frozen, json: unknown, signal: AbortSignal, model: string, addUsage: (u: Usage) => void): Promise<Output> {
    const bad = () => new WriterError('bad_output', 'The writer returned an unexpected shape.', { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
    if (f.kind === 'spark') {
      const p = sparkZ.safeParse(json); if (!p.success) throw bad();
      const zero: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
      const { ideas, usage, rhyme } = await this.studio.checkOrRetry(p.data.ideas, f.hooks ?? [], f.system, f.effort, signal, model, zero);
      addUsage(usage);
      const checks: Check[] = ideas.map((i, n) => ({ label: `idea ${n + 1}: title in the lines`, ok: (rhyme.hook.after ?? rhyme.hook.before)[n] !== 'none' }));
      return { kind: 'ideas', ideas: ideas.map((i) => ({ title: i.title, concept: i.concept, lines: i.lines.map((l) => l.trim()).filter(Boolean).slice(0, 4) })), checks, note: p.data.note ?? '' };
    }
    if (f.kind === 'rework') {
      const p = reworkZ.safeParse(json); if (!p.success) throw bad();
      let lines = p.data.lines.map((t) => t.trim()).filter(Boolean).slice(0, 4);
      for (const k of f.keep?.lines ?? []) if (!lines.includes(k)) { const at = Math.min(Math.max(0, f.keep!.original.indexOf(k)), lines.length); lines.splice(at, 0, k); }
      lines = lines.slice(0, Math.max(4, f.keep?.lines.length ?? 0));
      const checks: Check[] = (f.keep?.lines ?? []).map((k) => ({ label: `keeps “${k.slice(0, 30)}”`, ok: p.data.lines.map((l) => l.trim()).includes(k) }));
      if (f.keep?.title) checks.push({ label: 'keeps the title', ok: p.data.title.trim() === f.keep.title });
      return { kind: 'ideas', ideas: [{ title: f.keep?.title ?? p.data.title.trim(), concept: p.data.concept.trim(), lines }], checks, note: p.data.note ?? '' };
    }
    if (f.kind === 'write') {
      const p = writeZ.safeParse(json); if (!p.success) throw bad();
      const w = shapeWrite(p.data, f.constraints ?? {});
      if (w.kind === 'ideas') return { kind: 'ideas', ideas: w.ideas.map((i) => ({ title: i.title, concept: i.concept, lines: i.lines })), checks: [...w.checks, ...w.ideas.flatMap((i) => i.checks)], note: '' };
      if (w.kind === 'lines') return { kind: 'lines', options: w.options, note: '' };
      if (w.kind === 'draft') { const d = w.draft as unknown as { sections?: Array<{ label: string; lines: string[] }> } | null; return { kind: 'draft', sections: (d?.sections ?? []).map((x) => ({ label: x.label, lines: x.lines })), note: '' }; }
      return { kind: 'reply', text: w.reply ?? '' };
    }
    if (f.kind === 'suggest_replace') {
      const p = suggestReplaceZ.safeParse(json); if (!p.success) throw bad();
      const c = mergeConstraints(null, f.constraints ?? {});
      const options: Array<{ before: string; after: string; checks: Check[] }> = [];
      for (const o of p.data.options) {
        const byT = new Map(o.targets.map((t) => [t.target.trim().toUpperCase(), t.text]));
        const proposals = (f.targets ?? []).map((_, i) => byT.get(`T${i + 1}`));
        if (proposals.some((x) => x === undefined) || o.targets.length !== (f.targets ?? []).length) continue;
        let reps;
        try { reps = buildReplacements(f.sections!, f.targets!, proposals as string[]); } catch { continue; }
        const d = diffFor(f.sections!, reps);
        const checks: Check[] = [];
        const changed = reps.map((x) => x.newText);
        if (c.mustEndWith) checks.push({ label: `ends “${c.mustEndWith}”`, ok: endsWithPhrase(changed[changed.length - 1] ?? '', c.mustEndWith) });
        if (c.mustStartWith) checks.push({ label: `starts “${c.mustStartWith}”`, ok: startsWithPhrase(changed[0] ?? '', c.mustStartWith) });
        for (const w of c.forbidden) if ((proposals as string[]).some((x) => containsWord(x, w))) checks.push({ label: `avoids “${w}”`, ok: false });
        options.push({ before: d.map((x) => x.before).join(' / '), after: d.map((x) => x.after).join(' / '), checks });
      }
      return { kind: 'replace', options, note: p.data.note ?? '' };
    }
    if (f.kind === 'suggest_add') {
      const p = suggestAddZ.safeParse(json); if (!p.success) throw bad();
      const c = mergeConstraints(null, f.constraints ?? {});
      const options = p.data.options.map((o) => o.lines.map((l) => l.replace(/\s+$/g, '')).filter((l) => l.trim())).filter((ls) => ls.length).map((lines) => {
        const checks: Check[] = [];
        for (const w of c.forbidden) if (lines.some((l) => containsWord(l, w))) checks.push({ label: `avoids “${w}”`, ok: false });
        if (c.mustEndWith) checks.push({ label: `ends “${c.mustEndWith}”`, ok: endsWithPhrase(lines[lines.length - 1], c.mustEndWith) });
        return { lines, checks };
      });
      return { kind: 'lines', options, note: p.data.note ?? '' };
    }
    const p = titlesZ.safeParse(json); if (!p.success) throw bad();
    return { kind: 'titles', titles: p.data.titles.map((t) => ({ title: t.title.trim(), lines: t.lines.map((l) => l.trim()).filter(Boolean).slice(0, 3), why: t.why.trim() })).filter((t) => t.title).slice(0, 10), note: p.data.note ?? '' };
  }

  // ------------------------------------------------------------------ reading and judging
  async batches() {
    return this.db.query(`SELECT batch AS id, MIN(batch_name) AS name, MIN(created_at) AS created_at, MIN(repeat_of) AS repeat_of, COUNT(*) AS n,
      SUM(CASE WHEN verdict IS NOT NULL THEN 1 ELSE 0 END) AS judged FROM trials GROUP BY batch ORDER BY MIN(created_at) DESC`);
  }

  /** What he sees: A and B by their fixed sides; which had research only once every trial is judged. */
  async batch(id: string) {
    const rows = await this.db.query<TrialRow & { batch_name: string }>(`SELECT * FROM trials WHERE batch=$1 ORDER BY ord`, [id]);
    if (!rows.length) throw new AppError(404, 'not_found', 'No such test.');
    const done = rows.every((t) => t.verdict);
    return {
      id, name: rows[0].batch_name, done,
      trials: rows.map((t) => {
        const a = t.a_cond, b = a === 'on' ? 'off' : 'on';
        const o = t.outputs ?? {};
        return {
          id: t.id, n: t.ord + 1, route: t.route, shown: t.shown, verdict: t.verdict, seenAt: t.seen_at,
          A: o[a] ?? null, B: o[b] ?? null, failed: !!(o[`${a}Error` as 'offError'] || o[`${b}Error` as 'offError']),
          ...(done ? { reveal: { A: a, B: b, cards: t.frozen.research.cards } } : {}),
        };
      }),
    };
  }

  async seen(id: string) {
    await this.db.query(`UPDATE trials SET seen_at=COALESCE(seen_at, $2) WHERE id=$1`, [id, new Date().toISOString()]);
    return { ok: true };
  }

  async vote(id: string, v: { pick: Verdict['pick']; spark?: Partial<Verdict['spark']>; note?: string }) {
    const [t] = await this.db.query<TrialRow>(`SELECT * FROM trials WHERE id=$1`, [id]);
    if (!t) throw new AppError(404, 'not_found', 'No such trial.');
    if (!(t.outputs?.off && t.outputs?.on) && v.pick !== 'skip') throw new AppError(409, 'not_ready', 'Both versions aren’t written yet.');
    const verdict: Verdict = { pick: v.pick, spark: { A: !!v.spark?.A, B: !!v.spark?.B }, note: (v.note ?? '').trim().slice(0, 600), at: new Date().toISOString() };
    await this.db.query(`UPDATE trials SET verdict=$2, verdicts=$3 WHERE id=$1`, [id, JSON.stringify(verdict), JSON.stringify([...(t.verdicts ?? []), verdict])]);
    return this.batch(t.batch);
  }

  /** Counts by condition, once every trial has a verdict. Raw counts only: eight is not a statistic. */
  async tally(id: string) {
    const rows = await this.db.query<TrialRow>(`SELECT * FROM trials WHERE batch=$1 ORDER BY ord`, [id]);
    if (!rows.length || !rows.every((t) => t.verdict)) throw new AppError(409, 'not_done', 'Results show once every comparison has a verdict.');
    const runIds = rows.flatMap((t) => [t.run_ids?.off, t.run_ids?.on]).filter(Boolean) as string[];
    const runs = runIds.length ? await this.db.query<{ id: string; cost_usd: number | null; created_at: string; finished_at: string | null }>(`SELECT id, cost_usd, created_at, finished_at FROM runs WHERE id IN (${runIds.map((_, i) => `$${i + 1}`).join(',')})`, runIds) : [];
    const byRun = new Map(runs.map((r) => [r.id, r]));
    const sec = (r?: { created_at: string; finished_at: string | null }) => (r?.finished_at ? (Date.parse(r.finished_at) - Date.parse(r.created_at)) / 1000 : null);
    const per = rows.map((t) => {
      const v = t.verdict!;
      const cond = (side: 'A' | 'B') => (side === 'A' ? t.a_cond : t.a_cond === 'on' ? 'off' : 'on');
      const fails = (o?: Output) => (o && 'options' in o ? o.options.flatMap((x) => x.checks) : o && 'checks' in o ? o.checks : []).filter((c) => !c.ok).length;
      return {
        case: t.case_id, route: t.route, a: t.a_cond, pick: v.pick === 'A' || v.pick === 'B' ? cond(v.pick) : v.pick,
        spark: { on: v.spark[t.a_cond === 'on' ? 'A' : 'B'], off: v.spark[t.a_cond === 'on' ? 'B' : 'A'] }, note: v.note,
        cards: t.frozen.research.cards, failedChecks: { off: fails(t.outputs?.off), on: fails(t.outputs?.on) },
        seconds: { off: sec(byRun.get(t.run_ids?.off ?? '')), on: sec(byRun.get(t.run_ids?.on ?? '')) },
        cost: { off: byRun.get(t.run_ids?.off ?? '')?.cost_usd ?? null, on: byRun.get(t.run_ids?.on ?? '')?.cost_usd ?? null },
      };
    });
    const count = (p: string) => per.filter((x) => x.pick === p).length;
    return {
      batch: id, n: rows.length, on: count('on'), off: count('off'), both: count('both'), neither: count('neither'), skip: count('skip'),
      sparks: { on: per.filter((x) => x.spark.on).length, off: per.filter((x) => x.spark.off).length },
      aPicked: rows.filter((t) => t.verdict!.pick === 'A').length, bPicked: rows.filter((t) => t.verdict!.pick === 'B').length,
      per,
    };
  }
}
