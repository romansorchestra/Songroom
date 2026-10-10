// The research pack: craft cards, reference profiles and teaching pairs from
// research/pack/*.jsonl, plus a small keyword retriever. The pack is data; it
// never contains instructions and is never sent to the writer in full. At most
// a few records are rendered into one short "craft notes" block per request.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export type Card = {
  id: string; version: number; problem: string; technique: string; example: string;
  sources: string[]; findings?: string[]; evidence: string; effect: string;
  contexts: string[]; genres: string[]; tasks: string[]; when_not: string;
  audio_caveat?: string; confidence: string; open_questions?: string; related?: string[];
};
export type Profile = {
  id: string; name: string; aliases: string[]; resolved: string; sample: string[]; sources: string[];
  characteristics: Array<{ text: string; evidence: string }>; variation: string; uncertain: string; related_cards?: string[];
};
export type Pair = {
  id: string; original?: boolean; kind?: string; brief: string; context: string; constraints: Record<string, unknown>;
  a: string[]; b: string[]; tradeoff: string; analyst_view: string; links: string[]; use?: string;
};
export type Pack = { version: string; built: string; cards: Card[]; profiles: Profile[]; pairs: Pair[] };

export type PackTask = 'ideas' | 'lines' | 'edit' | 'draft' | 'unknown';
export type PackSelection = { version: string; cards: Card[]; profiles: Profile[]; pair: Pair | null };

/** Limits are deliberate starting points (brief §9); adjust through testing. */
export const PACK_LIMITS = { cards: 2, profiles: 2, pairs: 1, minScore: 3 };

function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l) as T);
}

export function loadPack(dir = path.resolve(process.cwd(), 'research', 'pack')): Pack | null {
  const manifest = path.join(dir, 'manifest.json');
  if (!existsSync(manifest)) return null;
  const m = JSON.parse(readFileSync(manifest, 'utf8')) as { pack_version?: string; built?: string };
  return {
    version: m.pack_version ?? 'unknown', built: m.built ?? '',
    cards: readJsonl<Card>(path.join(dir, 'cards.jsonl')),
    profiles: readJsonl<Profile>(path.join(dir, 'profiles.jsonl')),
    pairs: readJsonl<Pair>(path.join(dir, 'pairs.jsonl')),
  };
}

// Words in a request that point at a card's context tags. Plain keyword matching,
// no embeddings: it is inspectable and good enough for a few dozen cards.
const HINTS: Array<[RegExp, string[]]> = [
  [/\brhym/i, ['rhyme']],
  [/\b(syllables?|rhythm(ic)?|stress(es|ed)?|metre|meter|scans?|melody|fits? the (tune|melody)|same (rhythm|shape|length))\b/i, ['syllables', 'stress', 'melody_fit', 'rhythm']],
  [/\b(singable|sing-?along|sing (it )?back|first listen)\b/i, ['plainness', 'hook', 'chorus']],
  [/\b(placeholder|mumble|dummy|nonsense|la la|vowel)/i, ['placeholder', 'vowels']],
  [/\bhook/i, ['hook']],
  [/\bchorus/i, ['chorus']],
  [/\bpre[- ]?chorus|\bpre\b/i, ['pre_chorus']],
  [/\bverse/i, ['verse']],
  [/\bsecond verse|\bverse 2\b/i, ['second_verse']],
  [/\bbridge/i, ['bridge']],
  [/\b(outro|last chorus|final chorus|ending|end on|land on)\b/i, ['last_chorus', 'outro']],
  [/\b(open(er|ing)|first line|top of the song|intro)\b/i, ['opening']],
  [/\btitle/i, ['title']],
  [/\b(concept|idea|ideas|premise)\b/i, ['concept']],
  [/\b(angle|take on|point of view)\b/i, ['angle']],
  [/\b(stance|posture|where (she|he|the narrator) stands)\b/i, ['stance']],
  [/\b(not (a )?stor(y|ies)|no stor(y|ies)|no narrative|not narrative)\b/i, ['hook', 'stance', 'attitude']],
  [/\b(bite|biting|savage|sharp|cutting|barbed|dig|insult)/i, ['sarcasm', 'bluntness', 'attitude']],
  [/\b(get (us |me |it |you )?(from|to|into)|lead(s|ing)? (in)?to|connect|in between|hand(s)? over to)\b/i, ['structure', 'transitions']],
  [/\b(relationship|together|boyfriend|girlfriend|partner|husband|wife)\b/i, ['love']],
  [/\b(go wrong|fall apart|waiting for (it|the)|too good|other shoe)\b/i, ['unresolved', 'question']],
  [/\b(funny|humou?r|joke|witty|comic|sarcas|deadpan|wry)/i, ['humour', 'sarcasm']],
  [/\b(jealous|envy|envious)/i, ['jealousy', 'envy']],
  [/\b(petty|spite|grudge|bitter)/i, ['petty', 'grudge']],
  [/\b(attitude|swagger|sass|cocky|confident|bratty|cheeky)/i, ['attitude', 'swagger', 'persona']],
  [/\b(breakup|break-up|ex\b|exes|dump|split up|left me|leaving)/i, ['breakup']],
  [/\b(love song|in love|happy (relationship|love)|devotion|wedding|forever)/i, ['love', 'happy_love', 'devotion']],
  [/\b(sex|sexy|sensual|flirt|desire|want (him|her|you)|turn(ed)? on)/i, ['sex', 'desire']],
  [/\b(blunt|direct|straight|bluntly)\b/i, ['bluntness']],
  [/\b(plain|simple|plainly|simply|ordinary|unfussy)\b/i, ['plainness']],
  [/\b(generic|clich|stock|obvious|on the nose|too written)/i, ['generic', 'plainness']],
  [/\b(detail|specific|concrete|object|image|imagery)/i, ['detail', 'specificity', 'object']],
  [/\b(spoken|talk(ing|y)|speech|say it|interjection|ad.?lib)\b/i, ['spoken']],
  [/\b(conversational|like (people|someone|you) (talk|say)|how (people|you)'?d say it)\b/i, ['conversational']],
  [/\b(character|narrator|persona|voice)\b/i, ['character', 'persona', 'artist_voice']],
  [/\b(duet|two voices|reply verse|dialogue|a conversation|two sides)\b/i, ['duet', 'dialogue']],
  [/\b(question|unresolved|open ended|doesn'?t resolve)/i, ['question', 'unresolved']],
  [/\b(confess|admit|admission|vulnerab|sincere|honest|diary)/i, ['confession', 'admission']],
  [/\b(blame|fault|my fault|his fault|her fault)/i, ['blame']],
  [/\b(name|celebrity|brand)\b/i, ['name', 'celebrity', 'brand', 'proper_noun']],
  [/\b(place|city|town|hometown|la\b|london|nashville|vermont)/i, ['place']],
  [/\b(idiom|saying|phrase people say|turn (it|the phrase)|double meaning|two meanings)/i, ['idiom_flip', 'double_meaning', 'trope_reversal']],
  [/\b(cut|too long|drag|tighten|shorter|wordy)/i, ['cut_lines', 'density']],
  [/\b(fast|wordy|rhythmic|dense|internal rhyme)/i, ['fast_wordy', 'rhythm', 'density']],
  [/\b(connective|get (from|to)|lead into|transition|set ?up)/i, ['structure', 'transitions']],
  [/\b(build|escalat|crescendo|lift|payoff|climax)/i, ['escalation', 'last_chorus']],
  [/\b(co-?write|session|room|artist (says|said))/i, ['co_write', 'session_capture']],
  [/\b(protest|message|political|anthem)/i, ['message_song', 'anthem']],
  [/\b(loop|beat|track|groove)/i, ['loop', 'rhythm']],
  [/\b(country|nashville)/i, ['country']],
  [/\b(pop)\b/i, ['pop']],
  [/\b(rap|hip.?hop|bars)\b/i, ['hiphop']],
  [/\b(folk|singer.?songwriter|acoustic|ballad)/i, ['singer_songwriter']],
];

// Stop words plus the format words that appear in almost every request ("three ideas, title, angle, lines each").
const STOP = new Set('the a an and or of to in on for with without is it its this that he she him her they them you your i me my we our not no be as at by from into about just only very more less than then so if but like give me want each three four five one two title titles angle concept concepts idea ideas line lines sentence sentences option options alternative alternatives each'.split(' '));

export function tokens(text: string): Set<string> {
  return new Set(text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z][a-z'-]{2,}/g)?.filter((w) => !STOP.has(w)).map((w) => w.replace(/(ing|ed|es|s)$/, '')) ?? []);
}

export function inferTask(text: string, hasSong: boolean): PackTask {
  if (/\b(what do you think|your opinion|thoughts on|is (this|that|it) (a )?(good|bad)|does this work)\b/i.test(text)) return 'unknown';
  if (/\b(draft|write the (song|whole)|whole song|full song|write it all)\b/i.test(text)) return 'draft';
  if (/\b(ideas?|concepts?|titles?)\b/i.test(text) && !/\b(replace|replacements?|continuation|alternative lines?|second line|next line)\b/i.test(text)) return 'ideas';
  if (hasSong || /\b(lines?|couplets?|hooks?|endings?|options?|alternatives?|replace|continuation|passages?)\b/i.test(text)) return 'lines';
  return 'unknown';
}

// Tags that fire on the format of almost every request ("title, concept, three lines") count less
// than tags that describe the direction of the writing.
const TAG_WEIGHT: Record<string, number> = { concept: 1, angle: 1, title: 1, hook: 2, chorus: 2, verse: 2, ideas: 1 };

export function scoreCard(card: Card, hintTags: Set<string>, words: Set<string>, task: PackTask): number {
  let s = 0;
  let hits = 0;
  for (const t of card.contexts) if (hintTags.has(t)) { s += TAG_WEIGHT[t] ?? 3; hits++; }
  if (hits) s += 0.1 * hits; // tie-break: more matched lenses beat one strong match
  if (task !== 'unknown') { if (card.tasks.includes(task)) s += 1; else s -= 4; }
  if (task === 'ideas' && card.contexts.includes('ideas')) s += 1;
  for (const g of card.genres) if (hintTags.has(g)) s += 2;
  const own = tokens(`${card.problem} ${card.contexts.join(' ')}`);
  let overlap = 0;
  for (const w of words) if (own.has(w)) overlap++;
  s += Math.min(overlap, 3);
  if (card.confidence === 'low') s -= 2;
  return s;
}

function hintTagsFor(text: string): Set<string> {
  // Drop negated directions ("not a breakup song", "no truck imagery") so they don't fire as hints.
  const positive = text.replace(/\b(not|no|never|avoid|avoiding|without|don'?t (make|turn|write))\s+(it |this |a |an |the |into a |into |every )?[\w' -]{0,40}?(song|songs|story|stories|imagery|wording|ballad|premise|narrative)\b/gi, ' ');
  const tags = new Set<string>();
  for (const [re, ts] of HINTS) if (re.test(positive)) for (const t of ts) tags.add(t);
  return tags;
}

function fold(s: string): string { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

export function selectProfiles(pack: Pack, text: string, max = PACK_LIMITS.profiles): Profile[] {
  const f = fold(text);
  const hits = pack.profiles.filter((p) => [p.name, ...(p.aliases ?? [])].some((n) => n && f.includes(fold(n))));
  return hits.slice(0, max);
}

/** Pick a few records for one request. Returns an empty selection rather than guessing. */
export function selectPack(pack: Pack | null, input: { text: string; brief?: string; reference?: string | null; task: PackTask }, limits = PACK_LIMITS): PackSelection {
  if (!pack) return { version: 'none', cards: [], profiles: [], pair: null };
  const text = [input.text, input.brief ?? '', input.reference ?? ''].join('\n');
  const hintTags = hintTagsFor(text);
  const words = tokens(input.text);
  const scored = pack.cards.map((c) => ({ c, s: scoreCard(c, hintTags, words, input.task) })).filter((x) => x.s >= limits.minScore).sort((a, b) => b.s - a.s);
  const cards = scored.slice(0, limits.cards).map((x) => x.c);
  const profiles = selectProfiles(pack, [input.reference ?? '', input.text].join(' '), limits.profiles);
  let pair: Pair | null = null;
  if (limits.pairs > 0 && cards.length && (input.task === 'lines' || input.task === 'edit')) {
    pair = pack.pairs.find((p) => p.use !== 'evaluation' && p.kind !== 'ideas' && p.links.includes(cards[0].id)) ?? null;
  }
  return { version: pack.version, cards, profiles, pair };
}

/** The block sent to the writer. Short, lens-shaped, never an instruction to copy. */
export function renderPack(sel: PackSelection): string {
  if (!sel.cards.length && !sel.profiles.length) return '';
  const parts: string[] = [];
  if (sel.cards.length) {
    parts.push('Craft notes from working writers (lenses, not rules; his instruction and his own lyric always win; never mention these notes; do not make the writing sound studied or demonstrate a technique):');
    for (const c of sel.cards) parts.push(`- ${c.problem} → ${c.technique}${c.when_not ? ` Not when: ${c.when_not}` : ''}`);
  }
  if (sel.pair) {
    parts.push(`A teaching example (original, not from any song): ${sel.pair.brief}\nA: ${sel.pair.a.join(' / ')}\nB: ${sel.pair.b.join(' / ')}\nWhy: ${sel.pair.tradeoff}`);
  }
  for (const p of sel.profiles) {
    const chars = p.characteristics.slice(0, 5).map((x) => `  - ${x.text}`).join('\n');
    parts.push(`About the reference "${p.name}" (observations to translate into qualities, never to imitate):\n  ${p.resolved}\n${chars}${p.variation ? `\n  Variation: ${p.variation}` : ''}${p.uncertain ? `\n  Uncertain: ${p.uncertain}` : ''}`);
  }
  return parts.join('\n\n');
}
