// Blind three-way comparison (brief §10): the same fresh brief run under
//   A  p1.1            — the prompt that shipped on 9 Oct
//   B  p2.0            — corrected task/output instructions, no research
//   C  p2.0 + pack     — the same instructions plus a small retrieved craft-notes block
// Same model, effort, settings and song revision for all three. Sam judges the
// three outputs with their order shuffled; conditions are revealed only after
// his vote. None of these briefs was used to assemble the craft cards.

import type { Service, PromptPlan } from './service.js';
import { newId, allLines, type Target } from './engine/lyrics.js';

export type Condition = 'A' | 'B' | 'C';
export const CONDITIONS: Record<Condition, { label: string; plan: PromptPlan }> = {
  A: { label: 'p1.1 (9 Oct prompt)', plan: { variant: 'p1.1', pack: false } },
  B: { label: 'p2.0, no research', plan: { variant: 'p2.0', pack: false } },
  C: { label: 'p2.0 + craft notes', plan: { variant: 'p2.0', pack: true } },
};

type Brief =
  | { id: string; group: 'ideas'; label: string; direction: string; request: string; reference?: string }
  | { id: string; group: 'lines'; label: string; direction: string; context: string; lyric: string; request: string; reference?: string }
  | { id: string; group: 'edit'; label: string; direction: string; lyric: string; select: Array<{ line: number; span?: string }>; request: string };

export const EXPERIMENT_BRIEFS: Brief[] = [
  { id: 'X1', group: 'ideas', label: 'Pop hooks, texting first', direction: 'contemporary pop',
    request: 'Three contemporary pop ideas about being the one who always texts first. I want hooks and attitude, not stories. Title, the angle in one sentence, three lines each.' },
  { id: 'X2', group: 'ideas', label: 'Titles only, famous friend', direction: 'any',
    request: "Give me five titles and one line each for a song about a friend who got famous. Any genre. Don't explain them." },
  { id: 'X3', group: 'lines', label: 'Attitude second line', direction: 'pop, sweet surface',
    context: 'Female pop narrator, sweet on the surface and savage underneath. The chorus opens on the line given.', lyric: '[Chorus]\nYou call me difficult',
    request: "Four alternative second lines to follow 'You call me difficult'. Short, sayable, with bite. Keep the first line exact." },
  { id: 'X4', group: 'lines', label: 'Slant rhyme on goodbye', direction: 'pop, conversational',
    context: 'She left a party early because her ex was there and she pretended not to see him.', lyric: '[Verse]\nI left the party early\nDidn\'t say goodbye',
    request: "Three alternative single lines to follow those two, each landing on a natural slant rhyme with 'goodbye'. Conversational. No 'cry', no 'lie', no 'why'." },
  { id: 'X5', group: 'edit', label: 'Rhythm-matched replacement', direction: 'pop',
    lyric: "[Verse]\nYou said you'd text me when you landed\nThat was Tuesday, now it's June", select: [{ line: 0 }],
    request: 'Replace only the first line. Match its syllable count and stress as closely as you can. It should still be a small promise he made and didn\'t keep. Leave the second line exactly as it is.' },
  { id: 'X6', group: 'lines', label: 'Connective line', direction: 'mid-tempo, understated',
    context: 'Male narrator, understated. Verse 2 needs a plain second line that gets from his sister asking about her to the chorus. The chorus starts "I still buy the cereal you like" and must not be given away.', lyric: '[Verse 2]\nMy sister asked about you Sunday\n\n[Chorus]\nI still buy the cereal you like',
    request: "Three options for one line to go after 'My sister asked about you Sunday'. It just needs to get us to the chorus. Keep it plain; don't make it clever; don't give the chorus away." },
  { id: 'X7', group: 'ideas', label: 'Country, wrong promises', direction: 'country',
    request: 'Three country ideas about a man who kept the wrong promises. Plain speech. One of them should be funny. Title, angle in one sentence, three lines each.' },
  { id: 'X8', group: 'ideas', label: 'Character, downfall as comeback', direction: 'hip-hop-leaning character',
    request: "Three ideas for a character who narrates his own downfall like it's a comeback. Rhythmic, internal rhyme welcome, humour and vulnerability both. Not a breakup song. Title, angle in one sentence, three lines each." },
  { id: 'X9', group: 'lines', label: 'Direct chorus opener with "wait"', direction: 'pop, direct',
    context: 'She is in a good relationship and keeps waiting for it to go wrong.', lyric: '',
    request: "Three alternative two-line chorus openers. Direct, singable on first listen, no story, no metaphor-heavy lines. The word 'wait' must appear somewhere in each." },
  { id: 'X10', group: 'lines', label: 'Sensual, rhythm-led hook', direction: 'pop, late night',
    context: 'Late night, confident, playful. She wants someone and enjoys making them wait.', lyric: '',
    request: 'Three alternative four-line hooks about wanting someone and enjoying making them wait. Sensual but deniable, rhythm-led, short lines, no explicit words.' },
  { id: 'X11', group: 'edit', label: 'Keep the rhyme with keep', direction: 'pop ballad',
    lyric: "[Bridge]\nI kept your hoodie in the drawer\nLike that was something I could keep", select: [{ line: 0 }],
    request: "Three replacements for only the first line. Keep a natural sung rhyme or slant rhyme with 'keep', keep the sense of holding onto an object of his, no 'door' and no 'more'. Leave the second line exact." },
];

export const DEFAULT_REPEATS = 2;
export const BATCH_CAP_USD = 5;

async function waitRun(svc: Service, runId: string) {
  for (let i = 0; i < 1600; i++) {
    const r = await svc.getRun(runId);
    if (r.status !== 'running') return r;
    await new Promise((res) => setTimeout(res, 250));
  }
  return svc.getRun(runId);
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

async function runOne(svc: Service, brief: Brief, plan: PromptPlan) {
  if (brief.group === 'ideas') {
    const r = await svc.sendMessage({ threadId: null, text: brief.request, reference: brief.reference ?? null, clientKey: null, threadKind: 'eval', plan });
    return waitRun(svc, r.runId);
  }
  if (brief.group === 'lines') {
    const song = await svc.createSong({ title: `Experiment ${brief.id}`, text: brief.lyric, brief: brief.context, kind: 'eval' });
    const r = await svc.sendMessage({ threadId: null, songId: song.id, text: brief.request, reference: brief.reference ?? null, clientKey: null, plan });
    return waitRun(svc, r.runId);
  }
  const song = await svc.createSong({ title: `Experiment ${brief.id}`, text: brief.lyric, kind: 'eval' });
  const s = await svc.song(song.id);
  const lines = allLines(s.sections);
  const targets: Target[] = brief.select.map((sel) => {
    const line = lines[sel.line];
    if (sel.span) { const start = line.text.lastIndexOf(sel.span); return { kind: 'span', lineId: line.id, start, end: start + sel.span.length, expected: sel.span }; }
    return { kind: 'line', lineId: line.id, expected: line.text };
  });
  const r = await svc.edit(song.id, { baseRev: s.current_rev, targets, instruction: brief.request, clientKey: null, plan });
  if (r.direct) return { id: null, status: 'succeeded', result: r, error: null, cost_usd: 0 } as Record<string, unknown>;
  return waitRun(svc, r.runId!);
}

let running: Promise<void> | null = null;
let progress = { done: 0, total: 0, spent: 0, stopped: '' };

/** Await the batch in flight, if any (tests and shutdown). */
export async function waitExperiment(): Promise<void> { if (running) await running.catch(() => {}); }

/** Run every brief × repeat × condition, storing one blinded trial per (brief, repeat). */
export function startExperiment(svc: Service, opts: { ids?: string[]; repeats?: number }): { batch: string; started: boolean; trials: number } {
  if (running) return { batch: '', started: false, trials: 0 };
  const repeats = Math.min(Math.max(opts.repeats ?? DEFAULT_REPEATS, 1), 4);
  const briefs = EXPERIMENT_BRIEFS.filter((b) => !opts.ids?.length || opts.ids.includes(b.id));
  const batch = new Date().toISOString();
  progress = { done: 0, total: briefs.length * repeats * 3, spent: 0, stopped: '' };
  running = (async () => {
    outer: for (let rep = 1; rep <= repeats; rep++) {
      for (const b of briefs) {
        const order = shuffle(['A', 'B', 'C'] as Condition[]); // order[i] = condition shown at position i+1
        const outputs: Record<string, unknown>[] = [];
        for (const cond of order) {
          let rec: Record<string, unknown>;
          try {
            const run = await runOne(svc, b, CONDITIONS[cond].plan);
            rec = { condition: cond, runId: run.id, status: run.status, result: run.result, error: run.error, cost: run.cost_usd };
          } catch (e) {
            rec = { condition: cond, status: 'failed', error: { message: (e as Error).message } };
          }
          progress.done++;
          progress.spent += Number(rec.cost ?? 0);
          outputs.push(rec);
          const code = String((rec.error as { code?: string; message?: string } | undefined)?.code ?? (rec.error as { message?: string } | undefined)?.message ?? '');
          if (rec.status === 'failed' && /cap|no_writer|auth|balance/.test(code)) { progress.stopped = `Stopped: ${code}`; break outer; }
          if (progress.spent > BATCH_CAP_USD) { progress.stopped = `Stopped at the $${BATCH_CAP_USD} batch cap.`; break outer; }
        }
        const trial = {
          briefId: b.id, label: b.label, group: b.group, direction: b.direction, request: b.request,
          context: 'context' in b ? b.context : null, lyric: 'lyric' in b ? b.lyric : null, repeat: rep,
          positions: outputs.map((o, i) => ({ position: i + 1, ...o })), // conditions stay server-side until judged
        };
        await svc.db.query(`INSERT INTO experiments(id, batch, brief_id, repeat, trial) VALUES ($1,$2,$3,$4,$5)`, [newId('x_'), batch, b.id, rep, JSON.stringify(trial)]);
      }
    }
  })().finally(() => { running = null; });
  return { batch, started: true, trials: briefs.length * repeats };
}

type Row = { id: string; batch: string; brief_id: string; repeat: number; trial: Record<string, unknown>; vote: string | null; stars: string | null; note: string | null; created_at: string };

function blind(row: Row) {
  const t = row.trial as { positions: Array<Record<string, unknown>> } & Record<string, unknown>;
  const judged = !!row.vote;
  return {
    id: row.id, batch: row.batch, briefId: row.brief_id, repeat: row.repeat, vote: row.vote, stars: row.stars ? JSON.parse(row.stars) : [], note: row.note, createdAt: row.created_at,
    label: t.label, group: t.group, direction: t.direction, request: t.request, context: t.context, lyric: t.lyric,
    positions: t.positions.map((p) => ({
      position: p.position, status: p.status, result: p.result, error: p.error, cost: p.cost,
      condition: judged ? p.condition : null, conditionLabel: judged ? CONDITIONS[p.condition as Condition].label : null,
    })),
  };
}

export async function listExperiments(svc: Service) {
  const rows = await svc.db.query<Row>(`SELECT id, batch, brief_id, repeat, trial, vote, stars, note, created_at FROM experiments ORDER BY created_at DESC LIMIT 300`);
  return { running: !!running, progress, conditions: CONDITIONS, briefs: EXPERIMENT_BRIEFS.map((b) => ({ id: b.id, label: b.label, group: b.group })), trials: rows.map(blind) };
}

export async function judge(svc: Service, id: string, input: { vote: string | null; stars?: number[]; note?: string }) {
  if (input.vote !== null && !['1', '2', '3', 'none', 'tie'].includes(input.vote)) throw new Error('bad vote');
  await svc.db.query(`UPDATE experiments SET vote=$2, stars=$3, note=$4 WHERE id=$1`, [id, input.vote, JSON.stringify(input.stars ?? []), input.note ?? null]);
}

/** Tallies per condition over judged trials: wins, stars, and how many were judged at all. */
export async function tally(svc: Service) {
  const rows = await svc.db.query<Row>(`SELECT id, batch, brief_id, repeat, trial, vote, stars, note, created_at FROM experiments WHERE vote IS NOT NULL`);
  const out: Record<Condition, { wins: number; stars: number; shown: number; costTotal: number; byGroup: Record<string, number> }> = {
    A: { wins: 0, stars: 0, shown: 0, costTotal: 0, byGroup: {} }, B: { wins: 0, stars: 0, shown: 0, costTotal: 0, byGroup: {} }, C: { wins: 0, stars: 0, shown: 0, costTotal: 0, byGroup: {} },
  };
  let none = 0, tie = 0;
  for (const r of rows) {
    const t = r.trial as { group: string; positions: Array<{ position: number; condition: Condition; cost?: number }> };
    const stars: number[] = r.stars ? JSON.parse(r.stars) : [];
    for (const p of t.positions) {
      out[p.condition].shown++;
      out[p.condition].costTotal += Number(p.cost ?? 0);
      if (stars.includes(p.position)) out[p.condition].stars++;
      if (String(p.position) === r.vote) { out[p.condition].wins++; out[p.condition].byGroup[t.group] = (out[p.condition].byGroup[t.group] ?? 0) + 1; }
    }
    if (r.vote === 'none') none++;
    if (r.vote === 'tie') tie++;
  }
  return { judged: rows.length, none, tie, conditions: out };
}
