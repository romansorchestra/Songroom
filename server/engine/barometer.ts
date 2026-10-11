// The subject barometer: what songs that actually charted are about.
//
// Built from every song that entered the Spotify US daily Top 50 between Oct 2023
// and Oct 2026 (research/charts/, 1,225 songs; "hits" = a month or more in the top
// 50). The engine picks each idea's subject from this mix, so the writer is told a
// subject rather than choosing one, and three ideas in a batch never share one.
// His direction always wins: a subject is a default, not a rule.

import fs from 'node:fs';
import path from 'node:path';

export type Genre = 'pop' | 'diary_pop' | 'country' | 'hiphop' | 'latin' | 'rock_alt' | 'any';
export const GENRES: Array<{ id: Genre; label: string }> = [
  { id: 'pop', label: 'Pop' }, { id: 'diary_pop', label: 'Diary pop' }, { id: 'country', label: 'Country' }, { id: 'hiphop', label: 'Hip-hop' },
  { id: 'latin', label: 'Latin' }, { id: 'rock_alt', label: 'Alt / rock' }, { id: 'any', label: 'Any genre' },
];

/** In our words, for the writer. Never song titles or lyrics. */
export const SUBJECTS: Record<string, string> = {
  desire: 'wanting someone physically: attraction, flirting, a hookup, can’t keep away from them',
  relationship_trouble: 'still in it, or half in it, and it’s complicated: mixed signals, jealousy, can’t leave, cheating, a situationship, an ex you keep going back to',
  breakup_heartbreak: 'after it ended: missing them, getting over them, watching them move on, petty or bitter about it',
  romantic_love: 'in love and saying so: falling for someone, devotion, the person who makes ordinary life better',
  longing_unrequited: 'wanting someone you don’t have: out of reach, taken, or never chose you',
  self_confidence: 'self-worth: knowing what you deserve, not needing them, the glow-up, living by your own rules',
  party_nightlife: 'going out: the night, the dancefloor, drinks, letting loose with your people',
  struggle_inner: 'inside your own head: loneliness, regret, self-sabotage, admitting you’re the problem',
  flex_money_status: 'success and status: money, winning, rivals, proving the doubters wrong',
  nostalgia_hometown: 'the past and where you came from: growing up, the hometown, who you were',
  family_friends: 'the people who aren’t lovers: friends, family, loyalty',
  lifestyle_place: 'a way of life or a place you belong to',
  story_character: 'a story about someone else, told from outside',
};

type Barometer = { source: string; built: string; genres: Record<string, { n: number; relationship: number; subject: Record<string, number>; perspective: Record<string, number>; explicitness: Record<string, number>; title_device: Record<string, number>; concept_scale: Record<string, number> }> };

let cached: Barometer | null | undefined;
export function loadBarometer(file = path.resolve(process.cwd(), 'research', 'charts', 'barometer.json')): Barometer | null {
  if (cached !== undefined) return cached;
  try { cached = JSON.parse(fs.readFileSync(file, 'utf8')) as Barometer; } catch { cached = null; }
  return cached;
}

/** The genre to weight by: his chip if set, else words in his direction, else pop. */
export function genreFor(chip: string | undefined, text: string): Genre {
  if (chip && GENRES.some((g) => g.id === chip)) return chip as Genre;
  const t = text.toLowerCase();
  if (/gracie abrams|olivia rodrigo|diary|diaristic|confessional|sad girl|lizzy mcalpine|phoebe bridgers/.test(t)) return 'diary_pop';
  if (/\bcountry\b|nashville|\bhonky/.test(t)) return 'country';
  if (/hip[\s-]?hop|\brap\b|\btrap\b|\bdrill\b/.test(t)) return 'hiphop';
  if (/latin|reggaet|\bbachata|\bcorrido|spanish/.test(t)) return 'latin';
  if (/\brock\b|\balt\b|indie|\bemo\b|\bpunk\b/.test(t)) return 'rock_alt';
  return 'pop';
}

function weightsFor(genre: Genre): Array<[string, number]> {
  const b = loadBarometer();
  const g = b?.genres[genre === 'any' ? 'all' : genre] ?? b?.genres.pop;
  const fallback: Array<[string, number]> = [['desire', .19], ['relationship_trouble', .17], ['breakup_heartbreak', .16], ['romantic_love', .15], ['self_confidence', .11], ['longing_unrequited', .06], ['party_nightlife', .05], ['struggle_inner', .05]];
  const raw = g ? Object.entries(g.subject).filter(([k, v]) => SUBJECTS[k] && v >= 0.02) : fallback;
  return raw.length ? raw : fallback;
}

/**
 * Pick `count` different subjects, weighted by the chart mix for this genre; subjects
 * he has just seen are made less likely so consecutive batches don't feel the same.
 */
export function pickSubjects(genre: Genre, count: number, recent: string[] = [], rand: () => number = Math.random): string[] {
  const pool = weightsFor(genre).map(([k, w]) => [k, recent.includes(k) ? w * 0.35 : w] as [string, number]);
  const out: string[] = [];
  while (out.length < count && pool.length) {
    const total = pool.reduce((a, [, w]) => a + w, 0);
    let r = rand() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) { r -= pool[i][1]; if (r <= 0) break; }
    out.push(pool[i][0]);
    pool.splice(i, 1);
  }
  return out;
}

/** What the chart says about how these songs are told, for the idea brief. */
export function shapeNote(genre: Genre): string {
  const b = loadBarometer();
  const g = b?.genres[genre === 'any' ? 'all' : genre] ?? b?.genres.pop;
  if (!g) return '';
  if (genre === 'diary_pop') return DIARY_POP_NOTE;
  const pct = (x: number | undefined) => `${Math.round((x ?? 0) * 100)}%`;
  const label = GENRES.find((x) => x.id === genre)?.label.toLowerCase() ?? 'pop';
  return [
    `What ${genre === 'any' ? 'songs' : `${label} songs`} that actually charted on Spotify US in the last three years are like (${g.n} hits):`,
    `- ${pct(g.relationship)} are about a romantic or sexual relationship.`,
    `- ${pct(g.perspective.I_to_you)} are sung straight to "you"; ${pct(g.perspective.I_about_me)} are about the singer themself.`,
    `- ${pct(g.concept_scale.everyday)} are an everyday situation told plainly and ${pct(g.concept_scale.twisted_everyday)} an everyday situation with one clever angle; only ${pct(g.concept_scale.high_concept)} are built on an unusual premise or conceit.`,
    `- ${pct(g.title_device.plain_phrase)} of titles are a plain phrase people say; ${pct(g.title_device.metaphor_image)} are an image or metaphor.`,
    `- ${pct(g.explicitness.suggestive)} are suggestive and ${pct(g.explicitness.explicit)} explicit.`,
  ].join('\n');
}

// The diary-pop lane (Gracie Abrams, Olivia Rodrigo, Sabrina Carpenter, Tate McRae, Olivia
// Dean…), from research/charts/COHORT.md: 233 of their tracks with 80M+ streams, 2023–2026.
// Figures in our words; never song lines.
const DIARY_POP_NOTE = `What the diary-pop lane that actually streams is like (233 big tracks by its writers, 2023–2026):
- 83% are about a relationship or one specific person; the biggest subjects are after the breakup (22%), trouble while still in it (21%), wanting someone (14%), being in love (14%).
- The register is the point: 57% are conversational, sentences you could say or text to the person, read out loud; 63% are sung straight to "you".
- A third have a joke in them and a quarter have the singer undercutting herself; the most common tone after sad is wry. Angst is clear in under half.
- The album tracks fans push hardest are the messier, funnier, more specific ones: the situationship, the ex's new girl, the grudge, the self-sabotage. Not a mood: a situation with one checkable detail and one turn.
- Critics punish vagueness, sameness and self-help vocabulary in this lane; nobody here writes short aphorisms. Specific, talky and a little unflattering to the narrator wins.`;
