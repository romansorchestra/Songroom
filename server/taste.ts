// The taste test (18 Oct 2026). Sam: "I don't love the way that I have to enter all that
// information on the settings. It's putting me off doing it. Can you design a more intuitive
// and clever way to test my taste and my level of judgment?"
//
// Three minutes, one card at a time, nothing to type: pairs that differ in one named way
// (engine/tasteBank.ts), choruses with a planted weakness to find, then "Is this you?" over
// the songs already in his Journal. The engine scores what can be scored (planted weaknesses
// caught, the same call twice); one writer call reads the rest and says what it heard, each
// finding with its evidence counted. What he marks Keep becomes a standing lesson (source
// 'taste'); songs he marks Mine become voice examples. A preview (?preview=1) runs the real
// reading and saves nothing: that is how the live build is checked without touching his taste.

import { Service, AppError } from './service.js';
import { BANK, CARD, type PairCard, type FlawCard } from './engine/tasteBank.js';
import { tapHits, wordsOf, bare } from '../shared/taste.js';
import { tasteSchema, tasteZ } from './engine/schemas.js';
import { WriterError } from './engine/writer.js';
import { newId, type Section } from './engine/lyrics.js';
import { learnedBlock } from './learning.js';

export const TASTE_TEMPLATE = 'taste1';
/** One session: ten pairs, four choruses to read closely, two pairs shown again with the sides swapped. */
export const QUOTA = { title: 4, chorus: 3, idea: 3, planted: 3, clean: 1 } as const;
export const REPEATS = 2;
/** Fewer answers than this and there is nothing to read. */
export const MIN_ANSWERS = 6;
const FLAW_SLOTS = new Set([2, 6, 9, 12]);
const WHY = ['cliché', 'forced rhyme', "wouldn't say it", 'too much', 'vague', 'just not for me'] as const;
export const WHY_CHOICES: readonly string[] = WHY;

export type ShownCard =
  | { id: string; kind: 'pair'; what: PairCard['what']; options: Array<{ side: 'a' | 'b'; text: string }>; repeat: boolean }
  | { id: string; kind: 'flaw'; lines: [string, string]; planted: FlawCard['planted'] };

export type Answer =
  | { card: string; kind: 'pair'; repeat?: boolean; pick: 'a' | 'b' | 'neither'; ms: number }
  | { card: string; kind: 'flaw'; tap: { line: 0 | 1; word: number } | null; why?: string; mind?: 'fair' | 'fine'; ms: number };

export type Score = { pairs: number; neither: number; repeats: number; same: number; planted: number; caught: number; letThrough: number; otherWord: number; clean: number; cleanFine: number };
export type Heard = { you: string; rule: string; basis: string };

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** What the engine can count without a writer. */
export function score(answers: Answer[]): Score {
  const s: Score = { pairs: 0, neither: 0, repeats: 0, same: 0, planted: 0, caught: 0, letThrough: 0, otherWord: 0, clean: 0, cleanFine: 0 };
  const first = new Map<string, string>();
  for (const a of answers) {
    const c = CARD.get(a.card);
    if (!c) continue;
    if (a.kind === 'pair' && c.kind === 'pair') {
      if (a.repeat) {
        const f = first.get(a.card);
        if (f && f !== 'neither' && a.pick !== 'neither') { s.repeats++; if (f === a.pick) s.same++; }
      } else { s.pairs++; first.set(a.card, a.pick); if (a.pick === 'neither') s.neither++; }
    } else if (a.kind === 'flaw' && c.kind === 'flaw') {
      if (c.planted) {
        s.planted++;
        if (caught(c, a)) s.caught++; else if (a.tap) s.otherWord++; else s.letThrough++;
      } else { s.clean++; if (!a.tap) s.cleanFine++; }
    }
  }
  return s;
}

function caught(c: FlawCard, a: Extract<Answer, { kind: 'flaw' }>): boolean {
  return !!(c.planted && a.tap && a.tap.line === c.planted.line && tapHits(c.lines[a.tap.line], a.tap.word, c.planted.text));
}

export const TASTE_SYSTEM = `You are the co-writer in Songroom, writing notes for yourself. Sam, a professional songwriter, has just played a short taste test made of original material: pairs of titles, choruses and song ideas where the two options in each pair differ in one named way, and two-line choruses where one weakness was planted (some had none). Read his answers and write down what they show about his taste, as instructions you will follow when you write for him. Claim only what his answers show, and count the evidence.`;

export function tastePrompt(answers: Answer[], s: Score, known: string): string {
  const secs = (ms: number) => `${(Math.max(0, ms) / 1000).toFixed(1)} s`;
  const pairs = new Map<string, string[]>();
  const firstPick = new Map<string, string>();
  const flaws: string[] = [], clean: string[] = [];
  for (const a of answers) {
    const c = CARD.get(a.card);
    if (!c) continue;
    if (a.kind === 'pair' && c.kind === 'pair') {
      const key = `${c.axis} (${c.what === 'idea' ? 'song idea' : c.what})`;
      const out = pairs.get(key) ?? [];
      const q = (t: string) => `"${t.replace(/\n/g, ' / ')}"`;
      if (a.repeat) {
        const f = firstPick.get(a.card);
        out.push(`  shown again later with the sides swapped → ${a.pick === 'neither' ? 'neither' : f === a.pick ? 'chose the same' : 'chose the other one this time'}`);
      } else {
        firstPick.set(a.card, a.pick);
        const chose = a.pick === 'neither' ? 'neither (both below his bar)' : q(c[a.pick].text);
        out.push(`  ${q(c.a.text)} (${c.a.pole}) vs ${q(c.b.text)} (${c.b.pole}) → he chose ${chose}, in ${secs(a.ms)}`);
      }
      pairs.set(key, out);
    } else if (a.kind === 'flaw' && c.kind === 'flaw') {
      const both = `"${c.lines[0]} / ${c.lines[1]}"`;
      const tapped = a.tap ? `"${bare(wordsOf(c.lines[a.tap.line])[a.tap.word]?.text ?? '')}"` : '';
      const why = a.why ? `, and said what's wrong with it: ${a.why}` : '';
      const mind = a.mind === 'fine' ? ' Shown the planted one, he said: "I don\'t mind it."' : a.mind === 'fair' ? ' Shown the planted one, he said: "Fair, I missed it."' : '';
      if (c.planted) {
        const head = `- ${both} — planted: "${c.planted.text}" (${c.planted.flaw}).`;
        if (caught(c, a)) flaws.push(`${head} He tapped ${tapped}: caught, in ${secs(a.ms)}.`);
        else if (a.tap) flaws.push(`${head} He tapped ${tapped} instead${why}.${mind}`);
        else flaws.push(`${head} He said it was fine.${mind}`);
      } else {
        clean.push(a.tap ? `- ${both} — he tapped ${tapped}${why}. (He found this himself.)` : `- ${both} — he said it was fine.`);
      }
    }
  }
  const pairText = [...pairs.entries()].map(([k, v]) => `- Axis: ${k}\n${v.join('\n')}`).join('\n');
  return [
    `His answers. Pairs are grouped by the one way the two options differ; he never saw the descriptions in brackets.\n\nPairs:\n${pairText || '- (none answered)'}`,
    flaws.length ? `Choruses with a planted weakness:\n${flaws.join('\n')}` : '',
    clean.length ? `Choruses with nothing planted:\n${clean.join('\n')}` : '',
    `Counted by the app: caught ${s.caught} of ${s.planted} planted weaknesses; let ${s.letThrough} through; tapped a different word on ${s.otherWord}; made the same call on ${s.same} of ${s.repeats} pairs shown twice; picked neither on ${s.neither} of ${s.pairs} pairs.`,
    known ? `What you already know about his taste. Don't repeat it; if his answers contradict it, say so in the note:\n${known}` : 'You knew nothing about his taste before this test.',
    `How to answer
- "heard": three to six findings, strongest first. Each has:
  - "you": what his answers show, said to him plainly in the second person, at most 18 words. No praise.
  - "rule": the same finding as an instruction to yourself for every idea, title and line you write for him from now on. At most 30 words, concrete enough to use on a song that isn't in this test; don't quote the test's cards.
  - "basis": the evidence, counted ("4 of 4 title picks", "both pairs shown twice", "found it himself").
- A finding needs at least two picks on different cards pointing the same way, or one word he found that wasn't planted, with his reason: always write a finding for each of those, they are the strongest signal. One pick alone is not a finding. Where his picks split, leave it out.
- A planted weakness he let through and then said he doesn't mind is his permission, not a miss; write it only if it would change what you write.
- "Neither" means both options were below his bar; if he said it more than once, say what those options had in common.
- A pick under three seconds is surer than a slow one.
- Write about the writing, never about Sam as a person.
- "note": one short line on what the test couldn't tell, or where his answers disagree with what you knew; or empty.`,
  ].filter(Boolean).join('\n\n');
}

type SongRow = { id: string; title: string; current_rev: number };

export class Taste {
  constructor(private svc: Service) {}
  private get db() { return this.svc.db; }

  /** How many times each card has been answered (previews never count). */
  private async seen(): Promise<Map<string, number>> {
    const rows = await this.db.query<{ card: string; n: number }>(`SELECT card, COUNT(*) AS n FROM taste_answers WHERE again=0 GROUP BY card`);
    return new Map(rows.map((r) => [r.card, Number(r.n)]));
  }

  /** One session's cards: unseen first, the kinds interleaved, two pairs coming back with sides swapped. */
  async draw(rand: () => number = Math.random): Promise<ShownCard[]> {
    const seen = await this.seen();
    const live = BANK.filter((c) => !c.retired);
    const take = <T extends { id: string }>(pool: T[], n: number) => shuffle(pool, rand).sort((x, y) => (seen.get(x.id) ?? 0) - (seen.get(y.id) ?? 0)).slice(0, n);
    const pairsOf = (w: PairCard['what']) => live.filter((c): c is PairCard => c.kind === 'pair' && c.what === w);
    const flawsOf = (planted: boolean) => live.filter((c): c is FlawCard => c.kind === 'flaw' && !!c.planted === planted);
    const chosen = [...take(pairsOf('title'), QUOTA.title), ...take(pairsOf('chorus'), QUOTA.chorus), ...take(pairsOf('idea'), QUOTA.idea)];
    // the order with the fewest neighbours of the same kind, out of a few shuffles
    let pairs = shuffle(chosen, rand);
    const clash = (xs: PairCard[]) => xs.reduce((n, x, i) => n + (i && xs[i - 1].what === x.what ? 1 : 0), 0);
    for (let k = 0; k < 12 && clash(pairs); k++) { const t = shuffle(chosen, rand); if (clash(t) < clash(pairs)) pairs = t; }
    const flaws = shuffle([...take(flawsOf(true), QUOTA.planted), ...take(flawsOf(false), QUOTA.clean)], rand);
    const flip = new Map<string, boolean>();
    const showPair = (c: PairCard, repeat: boolean): ShownCard => {
      const f = repeat ? !flip.get(c.id) : rand() < 0.5;
      if (!repeat) flip.set(c.id, f);
      const opts: Array<{ side: 'a' | 'b'; text: string }> = [{ side: 'a', text: c.a.text }, { side: 'b', text: c.b.text }];
      return { id: c.id, kind: 'pair', what: c.what, options: f ? opts.reverse() : opts, repeat };
    };
    const out: ShownCard[] = [];
    const total = pairs.length + flaws.length;
    for (let i = 0, p = 0, q = 0; i < total; i++) {
      if ((FLAW_SLOTS.has(i) && q < flaws.length) || p >= pairs.length) { const c = flaws[q++]; out.push({ id: c.id, kind: 'flaw', lines: c.lines, planted: c.planted }); }
      else out.push(showPair(pairs[p++], false));
    }
    // two of the first half's pairs come back at the end, the other way round
    const early = out.slice(0, 7).filter((c) => c.kind === 'pair').map((c) => CARD.get(c.id) as PairCard);
    for (const c of shuffle(early, rand).slice(0, REPEATS)) out.push(showPair(c, true));
    return out;
  }

  /** His Journal songs he hasn't been asked about, with enough lines to hear a voice in. */
  async songs(): Promise<Array<{ id: string; title: string; text: string }>> {
    const asked = new Set(await this.asked());
    const voices = new Set((await this.svc.voiceExamples()).map((v) => v.text.trim()));
    const rows = await this.db.query<SongRow>(`SELECT id, title, current_rev FROM songs WHERE NOT archived ORDER BY updated_at DESC LIMIT 20`);
    const out: Array<{ id: string; title: string; text: string }> = [];
    for (const r of rows) {
      if (asked.has(r.id)) continue;
      const [rev] = await this.db.query<{ sections: Section[] }>(`SELECT sections FROM song_revisions WHERE song_id=$1 AND rev=$2`, [r.id, r.current_rev]);
      const text = (rev?.sections ?? []).map((s) => s.lines.map((l) => l.text).join('\n')).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
      if (text.split('\n').filter((l) => l.trim()).length < 4 || text.length > 6000 || voices.has(text)) continue;
      out.push({ id: r.id, title: r.title, text });
      if (out.length >= 6) break;
    }
    return out;
  }

  private async asked(): Promise<string[]> {
    const [row] = await this.db.query<{ value: string[] }>(`SELECT value FROM settings WHERE key='taste.songsAsked'`);
    return Array.isArray(row?.value) ? row.value : [];
  }

  async status() {
    const [r] = await this.db.query<{ n: number; last: string | null }>(`SELECT COUNT(DISTINCT session) AS n, MAX(created_at) AS last FROM taste_answers`);
    const kept = (await this.svc.lessons.list()).filter((l) => l.source === 'taste').length;
    const s = await this.svc.settings();
    const voices = (await this.svc.voiceExamples()).length;
    const sessions = Number(r?.n ?? 0);
    // "thin": the writer knows next to nothing he has said about his own taste
    return { sessions, last: r?.last ?? null, kept, voices, thin: sessions === 0 && kept === 0 && voices === 0 && !String(s.taste ?? '').trim() };
  }

  /** Keep his answers (unless a preview), take his songs, and ask the writer what it heard. */
  async read(input: { session: string; preview: boolean; answers: Answer[]; songs: Array<{ id: string; mine: boolean }> }, clientKey: string | null) {
    const seenKeys = new Set<string>();
    const answers = input.answers.filter((a) => {
      const c = CARD.get(a.card);
      const k = `${a.card}:${a.kind === 'pair' && a.repeat ? 1 : 0}`;
      if (!c || c.kind !== a.kind || seenKeys.has(k)) return false;
      if (a.kind === 'flaw' && a.tap && !wordsOf((c as FlawCard).lines[a.tap.line] ?? '')[a.tap.word]) return false;
      seenKeys.add(k); return true;
    });
    if (answers.length < MIN_ANSWERS) throw new AppError(400, 'too_few', `Answer at least ${MIN_ANSWERS} cards first.`);
    const s = score(answers);
    const [already] = input.preview ? [] : await this.db.query(`SELECT 1 FROM taste_answers WHERE session=$1 LIMIT 1`, [input.session.slice(0, 60)]);
    if (!input.preview && !already) {
      for (const a of answers) {
        await this.db.query(`INSERT INTO taste_answers(id, session, card, again, payload) VALUES ($1,$2,$3,$4,$5)`,
          [newId('ta_'), input.session.slice(0, 60), a.card, a.kind === 'pair' && a.repeat ? 1 : 0, JSON.stringify(a)]);
      }
      const asked = new Set(await this.asked());
      const offered = new Map((await this.songs()).map((x) => [x.id, x]));
      for (const g of input.songs) {
        const song = offered.get(g.id);
        if (!song) continue;
        if (g.mine) await this.svc.addVoice(song.title && song.title !== 'Untitled' ? song.title : '', song.text);
        asked.add(g.id);
      }
      await this.db.query(`INSERT INTO settings(key, value) VALUES ('taste.songsAsked', $1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [JSON.stringify([...asked].slice(-200))]);
    }
    const st = await this.svc.settings();
    const lessons = await this.svc.lessons.list();
    const known = [
      String(st.taste ?? '').trim() ? `His own notes:\n${String(st.taste).trim()}` : '',
      lessons.length ? `What he has told you before:\n${lessons.map((l) => `- ${l.text}`).join('\n')}` : '',
      learnedBlock(await this.svc.learning.current()),
    ].filter(Boolean).join('\n\n');
    const user = tastePrompt(answers, s, known);
    const run = await this.svc.startRun({
      task: 'taste', threadId: null, songId: null, clientKey, effort: st.effortEdit, promptVersion: TASTE_TEMPLATE,
      request: { session: input.session.slice(0, 60), preview: input.preview, answers: answers.length, score: s }, inputChars: TASTE_SYSTEM.length + user.length,
      exec: async (signal, model) => {
        const r = await this.svc.call('taste', TASTE_SYSTEM, user, tasteSchema, st.effortEdit, signal, model);
        const parsed = tasteZ.safeParse(r.json);
        if (!parsed.success) throw new WriterError('bad_output', 'The writer returned an unexpected shape.', r.usage);
        const tidy = (x: string, n: number) => x.replace(/\s+/g, ' ').trim().slice(0, n);
        const heard = parsed.data.heard.map((h) => ({ you: tidy(h.you, 160), rule: tidy(h.rule, 200), basis: tidy(h.basis, 60) })).filter((h) => h.you.length > 3 && h.rule.length > 3).slice(0, 6);
        return { result: { heard, note: tidy(parsed.data.note, 200), score: s, preview: input.preview, kept: [] }, usage: r.usage, requestId: r.requestId, model: r.model, live: r.live };
      },
      onSuccess: async () => {},
    });
    return { runId: run.id, score: s };
  }

  /** The findings he marked Keep become standing lessons the writer reads every time. */
  async keep(runId: string, keep: number[]) {
    const [run] = await this.db.query<{ task: string; status: string; request: { preview?: boolean }; result: { heard?: Heard[]; kept?: number[] } | null }>(`SELECT task, status, request, result FROM runs WHERE id=$1`, [runId]);
    if (!run || run.task !== 'taste') throw new AppError(404, 'not_found', 'Not found.');
    if (run.status !== 'succeeded' || !run.result?.heard) throw new AppError(409, 'not_ready', 'The reading isn’t finished yet.');
    if (run.request?.preview) throw new AppError(400, 'preview', 'This was a preview: nothing is kept.');
    const heard = run.result.heard;
    const want = [...new Set(keep)].filter((i) => Number.isInteger(i) && i >= 0 && i < heard.length);
    let added = 0;
    for (const i of want) {
      const h = heard[i];
      const l = await this.svc.lessons.add(h.rule, 'taste', { note: `${h.you} (${h.basis})`, scope: 'standing' });
      if (l) added++;
    }
    const kept = [...new Set([...(run.result.kept ?? []), ...want])].sort((a, b) => a - b);
    await this.db.query(`UPDATE runs SET result=json_set(result, '$.kept', json($2)) WHERE id=$1`, [runId, JSON.stringify(kept)]);
    return { kept, added };
  }
}
