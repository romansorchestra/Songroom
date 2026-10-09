// The test pack from the handoff (Appendix A): synthetic briefs, not Sam's songs.
// Each brief runs through exactly the same code path as the real app.

import type { Service } from './service.js';
import { newId, allLines, type Target } from './engine/lyrics.js';

type Brief =
  | { id: string; group: 'ideas'; label: string; request: string; judge: string }
  | { id: string; group: 'lines'; label: string; context: string; lyric: string; request: string; judge: string }
  | { id: string; group: 'edit'; label: string; lyric: string; select: Array<{ line: number; span?: string }>; request: string; judge: string };

export const BRIEFS: Brief[] = [
  { id: 'I1', group: 'ideas', label: 'Country, too late', judge: 'Distinct concepts, credible narrator, natural language, useful titles, seed lines that belong to each concept.',
    request: "Give me three distinct original song ideas about a man realising too late that repeated small choices cost him a relationship. Each needs a title, a two-sentence concept and three seed lines. He wasn't deliberately trying to end it. Avoid bar, truck and whiskey imagery in this batch. At least one idea should work through an ordinary concrete detail; don't make all three the same song." },
  { id: 'I2', group: 'ideas', label: 'Pop/rock, still checking', judge: 'Specificity, emotional contradiction, perspective, fresh execution rather than empowerment slogans.',
    request: "Three ideas from a woman who is furious that her ex is treating someone else better, and embarrassed that she's still checking. Let humour or self-awareness sharpen the hurt. Avoid declaring the new girlfriend an enemy. Title, concept and three lines each. No artist imitation or required rhyme." },
  { id: 'I3', group: 'ideas', label: 'Hip-hop, the big house', judge: 'Character, imagery, rhythmic possibility, genre flexibility, distinct angles.',
    request: "Three ideas about a narrator who can buy an impressive home but can't make anyone feel at home in it. Allow surreal imagery, humour and vulnerability; don't turn this into a country breakup ballad. Title, concept and three rhythmically interesting seed lines each. No mandatory title pun." },
  { id: 'I4', group: 'ideas', label: 'Surprise me', judge: 'Range, coherence, and whether a seed makes you want to write.',
    request: 'Give me three song ideas: one intimate, one funny with an uncomfortable truth, and one strange but emotionally clear. Any genre. Each needs a title, concept and three lines. Make the situations different; avoid three breakup songs.' },
  { id: 'L1', group: 'lines', label: 'Lights on, plates by the stove', judge: 'Specific detail and delayed recognition; opening untouched; no "Friday".',
    context: 'Male narrator has mistaken the absence of arguments for improvement; she has stopped expecting him home.',
    lyric: 'You got used to leaving lights on\nAnd plates by the stove',
    request: "Give me three alternative two-line continuations. Keep those opening lines untouched. Show his mistaken reading through behaviour; don't explain the entire song or mention Friday." },
  { id: 'L2', group: 'lines', label: 'Staged photos', judge: 'Singable speech, a real emotional implication, varied approaches.',
    context: 'A female pop narrator keeps staging photos to look over her ex, then checks whether he saw them.', lyric: '',
    request: "Give me three alternative couplets that reveal this without using social-media platform names or saying 'I'm not over you.' Keep it conversational. The joke should reveal hurt, not just be a caption." },
  { id: 'L3', group: 'lines', label: 'The host', judge: 'Character consistency, rhythmic opportunity, imagery; four lines each.',
    context: 'A character throws extravagant parties but feels relieved and lonely when guests leave.', lyric: '',
    request: "Three alternative four-line passages with room for internal rhyme. Include one physical action that exposes the contradiction. No generic 'crowded room but alone' wording. Don't resolve the conflict for him." },
  { id: 'L4', group: 'lines', label: 'Ending on "losing you"', judge: 'Set-up and payoff, meaning, natural phrasing.',
    context: 'A country narrator thinks absence has no cost until his partner stops waiting.', lyric: '',
    request: "Three alternative two-line chorus endings. Each must end with the exact words 'losing you'. The first line should set that phrase up meaningfully. A natural slant rhyme is welcome; don't force one. No leaving or breathing." },
  { id: 'E1', group: 'edit', label: 'One word only', judge: 'Exactly one word changes; everything else byte-for-byte identical.',
    lyric: '[Chorus]\nI kept coming home\nLike that was the same as staying\nYou were learning to let go\nI was practicing leaving',
    select: [{ line: 3, span: 'leaving' }], request: 'Change only the final word from leaving to losing. Keep everything else exactly the same.' },
  { id: 'E2', group: 'edit', label: 'Start and end fixed', judge: 'First line exact, middle untouched, last line ends "losing you" and means realisation, not intent.',
    lyric: '[Chorus]\nI was practicing leaving\nOne Friday at a time\nI kept saying we were fine\nLike saying made it true',
    select: [{ line: 0 }, { line: 3 }],
    request: "Keep the middle two lines exact. The first line must become 'I was practicing losing'. Give three options for the last line, each ending 'losing you'. He is realising what his behaviour meant, not admitting an intention to break up." },
  { id: 'E3', group: 'edit', label: 'Repeated sections', judge: 'Both pre-choruses change; the verse line with "quit" does not.',
    lyric: '[Verse 1]\nI quit calling after midnight\nThought that you were sleeping fine\n\n[Pre-Chorus]\nQuit getting mad\nI should\'ve been scared of that\n\n[Verse 2]\nYou packed the winter coats in June\n\n[Pre-Chorus]\nQuit getting mad\nI should\'ve been scared of that',
    select: [], request: "In both pre-choruses change 'Quit getting mad' to 'You stopped getting mad'. Don't change any other use of quit or any other lyric." },
  { id: 'E4', group: 'edit', label: 'Keep the rhyme', judge: 'No "leaving"; still the image of watching her drive away; second line untouched; natural sung rhyme with "dreaming".',
    lyric: "[Bridge]\nI watched the headlights leaving\nAnd told myself I'm dreaming",
    select: [{ line: 0 }],
    request: "Give three replacements for only the first line. Remove 'leaving' while keeping a natural sung rhyme or slant rhyme with 'dreaming'. Keep the sense of watching her drive away and approximately the same rhythm. Leave the second line exact. Avoid wording that only exists to make the rhyme." },
];

async function waitRun(svc: Service, runId: string) {
  for (let i = 0; i < 400; i++) {
    const r = await svc.getRun(runId);
    if (r.status !== 'running') return r;
    await new Promise((res) => setTimeout(res, 1000));
  }
  return svc.getRun(runId);
}

export async function runBrief(svc: Service, brief: Brief, batch: string) {
  const id = newId('e_');
  let record: Record<string, unknown> = { briefId: brief.id, label: brief.label, group: brief.group, request: brief.request, judge: brief.judge };
  try {
    if (brief.group === 'ideas') {
      const r = await svc.sendMessage({ threadId: null, text: brief.request, clientKey: null, threadKind: 'eval' });
      const run = await waitRun(svc, r.runId);
      record = { ...record, runId: r.runId, status: run.status, result: run.result, error: run.error, cost: run.cost_usd };
    } else if (brief.group === 'lines') {
      const song = await svc.createSong({ title: `Test pack ${brief.id}`, text: brief.lyric, brief: brief.context, kind: 'eval' });
      const r = await svc.sendMessage({ threadId: null, songId: song.id, text: brief.request, clientKey: null });
      const run = await waitRun(svc, r.runId);
      record = { ...record, lyric: brief.lyric, runId: r.runId, status: run.status, result: run.result, error: run.error, cost: run.cost_usd };
    } else {
      const song = await svc.createSong({ title: `Test pack ${brief.id}`, text: brief.lyric, kind: 'eval' });
      const s = await svc.song(song.id);
      const lines = allLines(s.sections);
      const targets: Target[] = brief.select.map((sel) => {
        const line = lines[sel.line];
        if (sel.span) {
          const start = line.text.lastIndexOf(sel.span);
          return { kind: 'span', lineId: line.id, start, end: start + sel.span.length, expected: sel.span };
        }
        return { kind: 'line', lineId: line.id, expected: line.text };
      });
      const r = await svc.edit(song.id, { baseRev: s.current_rev, targets, instruction: brief.request, clientKey: null });
      if (r.direct) {
        record = { ...record, lyric: brief.lyric, status: 'succeeded', direct: true, result: r, cost: 0 };
      } else {
        const run = await waitRun(svc, r.runId!);
        record = { ...record, lyric: brief.lyric, runId: r.runId, status: run.status, result: run.result, error: run.error, cost: run.cost_usd };
      }
    }
  } catch (e) {
    record = { ...record, status: 'failed', error: { message: (e as Error).message } };
  }
  await svc.db.query(`INSERT INTO eval_results(id, batch, brief_id, run_id, result) VALUES ($1,$2,$3,$4,$5)`,
    [id, batch, brief.id, (record.runId as string) ?? null, JSON.stringify(record)]);
  return record;
}

let running: Promise<void> | null = null;

export function startBatch(svc: Service, ids: string[]): { batch: string; started: boolean } {
  if (running) return { batch: '', started: false };
  const batch = new Date().toISOString();
  const briefs = BRIEFS.filter((b) => !ids.length || ids.includes(b.id));
  running = (async () => {
    for (const b of briefs) {
      const rec = await runBrief(svc, b, batch);
      // Stop the batch on a spend cap or connection problem instead of failing every brief.
      const code = (rec.error as { code?: string } | undefined)?.code;
      if (rec.status === 'failed' && /cap|no_writer|auth|balance/.test(String(code ?? (rec.error as { message?: string })?.message))) break;
    }
  })().finally(() => { running = null; });
  return { batch, started: true };
}

export async function latestResults(svc: Service) {
  const rows = await svc.db.query<{ id: string; batch: string; brief_id: string; result: unknown; vote: string | null; created_at: string }>(
    `SELECT id, batch, brief_id, result, vote, created_at FROM eval_results ORDER BY created_at DESC LIMIT 200`);
  return { running: !!running, results: rows, briefs: BRIEFS.map((b) => ({ id: b.id, label: b.label, group: b.group })) };
}

export async function vote(svc: Service, id: string, v: string | null) {
  if (v !== null && !['use', 'maybe', 'no'].includes(v)) throw new Error('bad vote');
  await svc.db.query(`UPDATE eval_results SET vote=$2 WHERE id=$1`, [id, v]);
}
