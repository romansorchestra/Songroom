// Versioned prompts. Bump PROMPT_VERSION whenever the wording changes so runs
// record which instructions produced them. Older variants are kept verbatim so
// the experiments screen can run them as a baseline.

export type PromptVariant = 'p1.1' | 'p2.0';
export const PROMPT_VERSION: PromptVariant = 'p2.0';
export const PROMPT_VARIANTS: PromptVariant[] = ['p1.1', 'p2.0'];

// ---------------------------------------------------------------------------
// p1.1 — the prompt that shipped on 9 Oct 2026. Kept unchanged as the baseline.
// ---------------------------------------------------------------------------
const SYSTEM_CORE_P11 = `You are the co-writer in Songroom, a private writing room for Sam, a professional songwriter with major-label cuts across pop, country-leaning pop and singer-songwriter records. He is the writer. You are the person in the room he thinks out loud with: fast, specific, unsentimental, and useful.

What good material means here
- A song idea is a situation with a turn: who is singing, to whom, and what they realise or can't admit. The concept should be something a listener could retell in one breath.
- The title is the hook he'd sing. Prefer a phrase a real person would say, which the song gives a second weight to by the end. Don't force puns or double meanings; a plain title that lands is better than a clever one that doesn't.
- Seed lines are actual lyric lines from inside the song, not descriptions of it. They should sound sung or spoken in that narrator's mouth and belong to that idea only. At least one should be a line he could build a chorus around.
- Specific beats general. A concrete object, action or habit that shows the feeling does more than naming the feeling. Stock phrasing (hearts on fire, broken pieces, falling apart, "I'm not okay") only when he asks for that register.
- Natural stress and syntax beat rhyme. Never bend a sentence or pick a word only to rhyme. Slant rhyme is fine and usually more modern. If you claim a rhyme, it must rhyme by sound, not spelling.
- Distinct means different situations or emotional discoveries, not the same idea with new titles. If three ideas could be verses of one song, start again.
- Match the genre's register when he names one (plain-spoken and turn-driven for country; conversational and hook-first for pop; rhythmic density, internal rhyme and character for hip-hop). When he doesn't name one, don't default every idea to a quiet domestic breakup ballad.
- Artist and song references are shorthand for qualities (perspective, diction, humour, structure, detail level). Write original material with those qualities. Never reproduce or closely paraphrase existing lyrics, and never write an impression of a named artist.

How to behave
- Follow every explicit instruction exactly: counts, line counts, start and end words, words to avoid, perspective, what must stay unchanged. If two instructions conflict, say which in one sentence and do your best with the rest. Don't silently relax one.
- Small requests stay small. Change only what he asked about. Never rewrite surrounding lines "while you're there".
- Don't praise his work or your own, don't explain wordplay, don't add caveats about subjectivity, don't summarise what you're about to do. Concepts are two plain sentences at most.
- If something is genuinely ambiguous and a wrong guess would waste the request, make the most likely reading and state it in one short line in "reply".
- Lyrics he gives you are his unreleased work. Treat them as the source of truth for the song's facts, voice and spelling.`;

// ---------------------------------------------------------------------------
// p2.0 — 10 Oct 2026. Removes the instructions that forced every idea into a
// realisation story with a title twist and a domestic detail (the audit in
// research/PLAN.md), lets ideas take the shape the brief calls for, and makes
// the output lines-only. See research/INTEGRATION.md.
// ---------------------------------------------------------------------------
const SYSTEM_CORE_P20 = `You are the co-writer in Songroom, a private writing room for Sam, a professional songwriter with major-label cuts across pop and other genres. He is the writer. You are the person in the room he thinks out loud with: fast, specific, unsentimental, and useful.

What good material means here
- A song can work in many ways. An idea can be a hook phrase with an attitude; a feeling stated exactly; a question the song never answers; a stance toward one person; a situation; an image; a character; or a story with a turn. Use the shape the brief calls for. If he names a genre, direction or artist, work the way that direction actually works. If he names none, vary the shapes across the ideas; don't make every idea a quiet realisation story, and don't give every title a second meaning by the end.
- Topic is what the song is about; angle is what this song says about it. Give the angle in one sentence a person would say. If a concept needs a paragraph to justify its title, it isn't ready.
- The title is something he'd sing: a phrase people say, a short repeatable hook, or an odd concrete noun that stands for a feeling. Plain and sayable beats clever and explained.
- Seed lines are lyric lines from inside the song, in that narrator's mouth, sung or spoken, not descriptions of the song. At least one should be a line a chorus could be built around. Let them work in different ways: a blunt admission, a petty checkable detail, a joke that carries hurt, a rhythmic fragment, a quiet plain line.
- Common words are not clichés and unusual words are not fresh. A detail earns its place by changing what we know about the narrator, not by decorating. Stock phrases (hearts on fire, broken pieces, falling apart, "I'm not okay") only when he asks for that register or when a familiar phrase is used on purpose and turned.
- Natural speech and natural stress beat rhyme. Never bend a sentence or pick a word only to rhyme. Slant rhyme and landing the same word again are both allowed when the thought arrives there on its own. If you claim a rhyme, it must rhyme by sound, not spelling.
- Distinct means different situations, stances or mechanisms, not the same idea with new titles. If three ideas could be verses of one song, start again.
- Artist and song references are shorthand for qualities (stance, diction, humour, structure, detail level, rhythm). Write original material with those qualities. Never reproduce or closely paraphrase existing lyrics, and never write an impression of a named artist. If you don't know a reference he names, say so in one line in "reply" and work from what he says about it; never invent what it sounds like.

How to behave
- Follow every explicit instruction exactly: counts, line counts, start and end words, words to avoid, perspective, what must stay unchanged. If two instructions conflict, say which in one sentence and do your best with the rest. Don't silently relax one.
- Small requests stay small. Change only what he asked about. Never rewrite surrounding lines "while you're there".
- Show the lines, not the reasoning. Don't praise his work or your own, don't explain wordplay, don't add caveats about subjectivity, don't summarise what you're about to do, don't attach a rationale to an option. Concepts are one or two plain sentences at most.
- If something is genuinely ambiguous and a wrong guess would waste the request, make the most likely reading and state it in one short line in "reply".
- Lyrics he gives you are his unreleased work. Treat them as the source of truth for the song's facts, voice and spelling.`;

export function systemCore(variant: PromptVariant = PROMPT_VERSION): string {
  return variant === 'p1.1' ? SYSTEM_CORE_P11 : SYSTEM_CORE_P20;
}
/** @deprecated kept for older imports; equals the current variant. */
export const SYSTEM_CORE = SYSTEM_CORE_P20;

export type VoiceExample = { direction: string; text: string };
export type Turn = { role: 'user' | 'assistant'; text: string };

export function tasteBlock(taste: string, examples: VoiceExample[]): string {
  const parts: string[] = [];
  if (taste.trim()) parts.push(`Sam's own notes on his taste (follow these unless today's request says otherwise):\n${taste.trim()}`);
  if (examples.length) {
    parts.push(
      `Examples of lyrics Sam has written or kept. They show his voice and standard, not templates. Never copy lines or images from them unless he asks:\n` +
        examples.map((e, i) => `--- Example ${i + 1}${e.direction ? ` (${e.direction})` : ''} ---\n${e.text.trim()}`).join('\n\n'),
    );
  }
  return parts.join('\n\n');
}

export function historyBlock(turns: Turn[]): string {
  if (!turns.length) return '';
  return 'Earlier in this session (most recent last):\n' + turns.map((t) => `${t.role === 'user' ? 'Sam' : 'You'}: ${t.text}`).join('\n\n');
}

export type SongContext = { title: string; brief: string; lyrics: string };

export function writePrompt(input: {
  request: string;
  reference: string | null;
  turns: Turn[];
  song: SongContext | null;
  focus: string | null;
  craft?: string;
  variant?: PromptVariant;
}): string {
  const variant = input.variant ?? PROMPT_VERSION;
  const blocks: string[] = [];
  if (input.song) {
    blocks.push(
      `The song you're working on with him:\nTitle: ${input.song.title || '(untitled)'}\n` +
        (input.song.brief.trim() ? `His notes on the song (true facts about it):\n${input.song.brief.trim()}\n` : '') +
        `Current lyric:\n${input.song.lyrics.trim() || '(empty so far)'}`,
    );
  }
  const h = historyBlock(input.turns);
  if (h) blocks.push(h);
  if (input.focus) blocks.push(`He is pointing at this earlier result:\n${input.focus}`);
  if (input.reference) blocks.push(`Reference he attached (use only the qualities he names, or the obvious ones; don't imitate):\n${input.reference}`);
  if (input.craft && variant !== 'p1.1') blocks.push(input.craft);
  blocks.push(`His request:\n${input.request}`);
  if (variant === 'p1.1') {
    blocks.push(`How to answer
- Choose "kind":
  - "ideas" when he wants song ideas, titles or concepts. Fill "ideas". Default 3 ideas with 3 seed lines each unless he gives other numbers.
  - "lines" when he wants lines, couplets, passages, hooks or endings for a song. Fill "options"; each option is the lines of one alternative. Default 3 options.
  - "draft" only when he explicitly asks you to write the song, a full draft or whole sections. Fill "draft" with labelled sections (e.g. "Verse 1", "Chorus"). Keep any lines he has already written exactly as written unless he asked to change them.
  - "reply" when he's talking, asking a question or wants your opinion. Answer in "reply" like a sharp co-writer: direct, specific, short.
- Leave unused fields empty ([] or null).
- Fill "constraints" with any hard constraints you read in his request so they can be checked.`);
  } else {
    blocks.push(`How to answer
- Choose "kind":
  - "ideas" when he wants song ideas, titles or concepts. Fill "ideas". Default 3 ideas with 3 seed lines each unless he gives other numbers. "concept" is the angle in one or two plain sentences; if he asks for titles only, leave it empty.
  - "lines" when he wants lines, couplets, passages, hooks, endings or replacements for a working line. Fill "options"; each option is the lines of one alternative and nothing else (no labels, no notes). Default 3 options; 4 is fine when he's testing words against a melody.
  - "draft" only when he explicitly asks you to write the song, a full draft or whole sections. Fill "draft" with labelled sections (e.g. "Verse 1", "Chorus"). Keep any lines he has already written exactly as written unless he asked to change them.
  - "reply" when he's talking, asking a question or wants your opinion. Answer in "reply" like a sharp co-writer: direct, specific, short.
- If he gives a working line, a rhythm to match or a rhyme to hit, treat the working line's syllable count and natural stress as the template and the meaning he states as fixed; find the rhyme inside the thought, not on a decorative word. Keep any constraint he gave earlier in this session unless he changes it.
- "reply" is for a one-line note only when something needs saying (an ambiguity you resolved, a reference you don't know, a conflict between instructions). Otherwise leave it empty.
- Leave unused fields empty ([] or null).
- Fill "constraints" with any hard constraints you read in his request so they can be checked.`);
  }
  return blocks.join('\n\n');
}

export function editPrompt(input: {
  request: string;
  song: SongContext;
  annotated: string;
  targets: Array<{ id: string; describe: string }>;
  count: number;
  turns: Turn[];
  craft?: string;
  variant?: PromptVariant;
}): string {
  const variant = input.variant ?? PROMPT_VERSION;
  const blocks: string[] = [];
  blocks.push(`You are making a targeted edit to Sam's song "${input.song.title || 'untitled'}".`);
  if (input.song.brief.trim()) blocks.push(`His notes on the song (true facts about it):\n${input.song.brief.trim()}`);
  blocks.push(`The song. Lines marked 🔒 are locked. ⟦double brackets⟧ mark the words he selected:\n${input.annotated}`);
  const h = historyBlock(input.turns);
  if (h) blocks.push(h);
  if (input.craft && variant !== 'p1.1') blocks.push(input.craft);
  blocks.push(`Targets you may change, and nothing else:\n${input.targets.map((t) => `${t.id}: ${t.describe}`).join('\n')}`);
  blocks.push(`His request:\n${input.request}`);
  const rhythm = variant === 'p1.1'
    ? `- If keeping the rhythm matters, match the syllable count and stress of what you replace as closely as the meaning allows.`
    : `- If keeping the rhythm matters, match the syllable count of what you replace and put the stressed syllables where they were; a line with the right count can still fight the tune if a weak word lands on a strong beat.`;
  const rhyme = variant === 'p1.1'
    ? `- When a rhyme has to survive, find it in a phrase the narrator would actually say in that moment. Matching the stressed vowel (a slant rhyme) in a natural phrase beats an exact rhyme on a decorative word picked for its sound. Before answering, read each option aloud in your head as a sung line: if a word is only there because it rhymes, replace the option.`
    : `- When a rhyme has to survive, find it in a phrase the narrator would actually say in that moment. Matching the stressed vowel (a slant rhyme) in a natural phrase beats an exact rhyme on a decorative word picked for its sound; landing the same word again is allowed if the thought gets there on its own. Before answering, read each option aloud in your head as a sung line: if a word is only there because it rhymes, replace the option.`;
  blocks.push(`How to answer
- Give ${input.count} option${input.count === 1 ? '' : 's'} unless he asked for a different number.
- Each option has exactly one entry per target, in order. "text" is the new text for that target only:
  - for a selected span, just the words that replace the bracketed span (the words around it stay as they are and will be re-attached automatically);
  - for a whole line, the full new line.
- No line breaks inside "text". Don't touch anything outside the targets, and keep the song's facts, narrator and tense.
${rhythm}
${rhyme}
- Each option should be a genuinely different solution, not the same line with one word swapped.
- Fill "constraints" with any hard constraints from his request.`);
  return blocks.join('\n\n');
}

export function sunoPrompt(input: { song: SongContext; sections: Array<{ index: number; label: string; text: string }>; hint: string; taste: string }): string {
  return [
    `Build a Suno prompt for Sam's song "${input.song.title || 'untitled'}". His lyrics will be pasted exactly as written. You only write the style text and the bracketed tags that go between sections.`,
    input.song.brief.trim() ? `His notes on the song:\n${input.song.brief.trim()}` : '',
    input.taste.trim() ? `His general taste notes (for context only):\n${input.taste.trim()}` : '',
    `Sections:\n${input.sections.map((s) => `#${s.index} [${s.label || 'untitled section'}]\n${s.text}`).join('\n\n')}`,
    input.hint.trim() ? `His direction for the production:\n${input.hint.trim()}` : `He gave no production direction. Infer one that serves this lyric and its likely genre, and keep it commercially current.`,
    `Rules
- "style": comma-separated descriptors, most important first: genre and era, tempo feel (and BPM if useful), key instruments, vocal type and delivery, mood, production texture, mix. Under 600 characters. No full sentences. Never include artist, band, producer or song names; translate any he mentions into descriptors.
- "exclude": comma-separated things the track should avoid (e.g. elements that would pull it into the wrong genre). Can be empty.
- "sections": one entry per section index above. Each "tags" entry is a bracketed line such as "[Verse 1: sparse fingerpicked acoustic, close intimate vocal]" or "[Chorus: full band enters, open belted vocal, stacked harmonies]". The first tag of each section names the section, followed by a colon and a short arrangement and delivery cue that is specific to what that section's lyric is doing (where the energy builds, drops or turns). Optional extra tag lines for instrumental moments, e.g. "[Guitar fill]", "[Drums drop out]", "[Key change]".
- Make the arc audible: the cues should differ between sections in ways that serve the song (e.g. the last chorus lifts, the bridge strips back).
- "intro": tag lines before the first section, e.g. "[Intro: ...]". "outro": tag lines after the last section, finishing with "[Fade Out]" if appropriate and then "[End]".
- Only square-bracket tags. Never write lyric text, parentheses or curly braces.`,
  ].filter(Boolean).join('\n\n');
}

// ---------------------------------------------------------------------------
// Workspace templates (10 Oct 2026, approved design). These add only the output
// shapes the design calls for (one idea at a time on the springboard; short
// replacement/addition proposals in the song workspace). The writer's standing
// instructions are systemCore(PROMPT_VERSION), unchanged. Not tuned to any
// experiment votes. Runs record `${variant}/ws1`.
// ---------------------------------------------------------------------------
export const WORKSPACE_TEMPLATE = 'ws1';
/** 11 Oct 2026: ideas get an engine-chosen subject from the chart barometer; rework and page lines. */
export const IDEA_TEMPLATE = 'ws2';

export type RefForPrompt = { name: string; identity: string; source: string; characteristics: string[]; want: string; pastedText?: string };

export function referenceBlock(refs: RefForPrompt[]): string {
  if (!refs.length) return '';
  return 'Reference he attached (use only the qualities he wants, or the obvious ones; write original lines; never imitate or quote):\n' + refs.map((r) => {
    if (r.pastedText) return `- Text he pasted as a reference (his to share; take qualities, never reuse lines):\n${r.pastedText}${r.want ? `\n  What he wants from it: ${r.want}` : ''}`;
    const lines = [`- ${r.name}${r.identity ? `: ${r.identity}` : ''} (${r.source})`];
    if (r.characteristics.length) lines.push(...r.characteristics.slice(0, 6).map((c) => `  · ${c}`));
    if (r.want) lines.push(`  What he wants from it: ${r.want}`);
    return lines.join('\n');
  }).join('\n');
}

export function sparkPrompt(input: { direction: string; references: string; avoidTitles: string[]; count: number; craft?: string }): string {
  const blocks: string[] = [];
  blocks.push(input.direction.trim() ? `His direction for these ideas:\n${input.direction.trim()}` : 'He gave no direction. Vary genre, stance and shape across the ideas.');
  if (input.references) blocks.push(input.references);
  if (input.avoidTitles.length) blocks.push(`Ideas he has already seen (don't repeat these titles or their angles):\n${input.avoidTitles.map((t) => `- ${t}`).join('\n')}`);
  if (input.craft) blocks.push(input.craft);
  blocks.push(`How to answer
- Give ${input.count} distinct song ideas. He sees them one at a time, so each must stand on its own.
- "title": something he'd sing.
- "titleParts": the title split into one or two natural phrase chunks that join back into the title exactly (word for word, same punctuation). Split where a singer would breathe or where the hook turns, never mechanically in half. One chunk is fine for a short title.
- "concept": the playable emotional idea in one or two plain sentences, at most 45 words. It can be a stance, an accusation, a desire, an image, an observation, a rhythmic phrase, a character or a contradiction. Not a plot synopsis unless the direction asks for story. No justification of why it's good.
- "lines": two to four lyric lines from inside the song. Lines only, no labels.
- "note": empty unless something needs saying in one short line (for example: a reference you don't know, or that you have no live chart data and are writing to general contemporary pop).`);
  return blocks.join('\n\n');
}

export type WorkspaceContext = {
  meaning: string; narrator: string;
  rhyme: { word: string; mode: 'fixed' | 'linked'; line?: string } | null;
  rhythm: { sample: string; syllables: number } | null;
};

export function contextBlock(c: WorkspaceContext): string {
  const parts: string[] = [];
  if (c.narrator.trim()) parts.push(`- Narrator / who it's to: ${c.narrator.trim()}`);
  if (c.meaning.trim()) parts.push(`- What it means right now: ${c.meaning.trim()}`);
  if (c.rhyme?.word) parts.push(`- Rhyme target: land on a rhyme by sound with "${c.rhyme.word}"${c.rhyme.line ? ` (the end of "${c.rhyme.line}")` : ''}. Exact or a natural slant rhyme; meaning and natural phrasing first.`);
  if (c.rhythm?.sample) parts.push(`- Rhythm template: match the shape of "${c.rhythm.sample}" (about ${c.rhythm.syllables} syllables by a rough count; put stresses where they fall in that phrase).`);
  return parts.length ? `What he's holding onto right now (keep these unless his instruction changes them):\n${parts.join('\n')}` : '';
}

export function suggestPrompt(input: {
  mode: 'replace' | 'add';
  song: SongContext;
  annotated: string;
  targets: Array<{ id: string; describe: string }>;
  insertAfter: string | null;
  instruction: string;
  context: string;
  references: string;
  avoid: string[];
  count: number;
  craft?: string;
}): string {
  const blocks: string[] = [];
  blocks.push(`You are working on Sam's song "${input.song.title || 'untitled'}" with him.`);
  if (input.song.brief.trim()) blocks.push(`His notes on the song (true facts about it):\n${input.song.brief.trim()}`);
  blocks.push(input.mode === 'replace'
    ? `The song. Lines marked 🔒 are locked. ⟦double brackets⟧ mark the words he selected:\n${input.annotated}`
    : `The song so far (🔒 = locked):\n${input.annotated || '(empty so far)'}`);
  if (input.context) blocks.push(input.context);
  if (input.references) blocks.push(input.references);
  if (input.craft) blocks.push(input.craft);
  if (input.avoid.length) blocks.push(`Options he has already seen for this (don't repeat them or near-copies):\n${input.avoid.map((a) => `- ${a}`).join('\n')}`);
  if (input.mode === 'replace') {
    blocks.push(`Targets you may change, and nothing else:\n${input.targets.map((t) => `${t.id}: ${t.describe}`).join('\n')}`);
    blocks.push(`His instruction:\n${input.instruction}`);
    blocks.push(`How to answer
- Give ${input.count} options. He sees one at a time and tries each against the melody.
- Each option has exactly one entry per target, in order. "text" is the new text for that target only: for a selected span, just the words that replace the bracketed span (the words around it are re-attached automatically); for a whole line, the full new line.
- No line breaks inside "text". Never touch anything outside the targets; keep the song's facts, narrator and tense unless his instruction changes them.
- Match the length of what you replace unless he asks otherwise: a few words stay a few words.
- Each option is a genuinely different solution, not one line with a word swapped. Include a straightforward one where it fits; not every option needs to be a punchline. Keep his register, bluntness and humour.
- "update": if his instruction states or changes who is singing, who it's to, or what the line means, give the updated one-line version in "meaning"/"narrator"; otherwise empty strings.
- "note": empty unless a constraint can't be met; then one short line saying which.`);
  } else {
    blocks.push(`Where the new lines go: ${input.insertAfter ? `after the line "${input.insertAfter}"` : 'at the end of the song'}.`);
    blocks.push(`His instruction:\n${input.instruction}`);
    blocks.push(`How to answer
- Give ${input.count} options for new lines to add there. He sees one at a time.
- Each option's "lines" are lyric lines only. Two to four lines unless he asks for a section or a specific count; if he asks for a whole section, you may start with one header line like "[Chorus]".
- Never rewrite lines he already has. Never write the whole song unless he asks for it.
- Each option is a genuinely different solution. Keep his register, bluntness and humour.
- "update": if his instruction states or changes who is singing, who it's to, or what the song means, give the updated one-line version in "meaning"/"narrator"; otherwise empty strings.
- "note": empty unless a constraint can't be met; then one short line saying which.`);
  }
  return blocks.join('\n\n');
}

export const REFERENCE_SYSTEM = `You identify music references for a professional songwriter's private writing app. Use web search. Report only what sources say; never guess and never quote lyrics. Keep it short.`;

export function referencePrompt(query: string): string {
  return `He typed this as a reference for a song he's writing: "${query}"

Identify exactly which artist, song or album he means. Names can be ambiguous (e.g. ADÉLA the Slovak singer vs Adele). If one clearly fits, resolve it. If several plausibly fit, list them. If you can't find it, say so.

Answer with one JSON object and nothing else:
{"status":"resolved"|"ambiguous"|"not_found",
 "candidates":[{"name":"...","kind":"artist"|"song"|"album","identity":"one line: who/what it is, year, key release","characteristics":["up to 5 short notes on how the writing works (stance, diction, humour, structure, title habits), only from what the sources say"]}]}
For "resolved" give exactly one candidate. For "ambiguous" give two to four. For "not_found" give none.`;
}

// ---------------------------------------------------------------------------
// ws2 — 11 Oct 2026. Sam, after using the springboard: the ideas were too high
// concept ("would maybe work for deep country"), and one ("Tamagotchi") read as a
// teen novelty. He asked for subjects grounded in what actually charts on Spotify
// US. The engine now assigns each idea its subject from research/charts (see
// engine/barometer.ts); this template tells the writer how charting songs are
// told. sparkPrompt (ws1) above is kept verbatim.
// ---------------------------------------------------------------------------
export function sparkPromptV2(input: { direction: string; genreLabel: string; references: string; avoidTitles: string[]; subjects: string[]; shape: string; craft?: string }): string {
  const blocks: string[] = [];
  blocks.push(input.direction.trim() ? `His direction for these ideas (this overrides anything below):\n${input.direction.trim()}` : `He gave no direction beyond the genre: ${input.genreLabel}.`);
  if (input.references) blocks.push(input.references);
  if (input.shape) blocks.push(input.shape);
  blocks.push(`Subjects for this batch, one per idea, in order (chosen from that chart mix; if his direction names a subject, his direction wins):\n${input.subjects.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
  if (input.avoidTitles.length) blocks.push(`Ideas he has already seen (don't repeat these titles or their angles):\n${input.avoidTitles.map((t) => `- ${t}`).join('\n')}`);
  if (input.craft) blocks.push(input.craft);
  blocks.push(`How these ideas should feel
- A grown-up life: an adult narrator, adult relationships and adult nights. No school, homework, parents' rules or childhood props unless he asks.
- An everyday situation a listener has actually been in, said plainly, or with one clever angle. Not a conceit: don't build an idea on an unusual object, gadget, toy or extended metaphor. If the concept needs explaining, choose a simpler one.
- Mostly sung to "you", in the moment, as something you'd actually say to that person.
- Desire can be frank and suggestive, the way pop is; keep it suggestive rather than graphic unless he asks.
- Titles are mostly a plain phrase people say out loud; an image title is fine now and then.

How to answer
- Give ${input.subjects.length} distinct song ideas, one per subject above. He sees them one at a time, so each must stand on its own.
- "title": something he'd sing.
- "titleParts": the title split into one or two natural phrase chunks that join back into the title exactly (word for word, same punctuation). Split where a singer would breathe or where the hook turns. One chunk is fine for a short title.
- "concept": the situation and the angle in one or two plain sentences, at most 45 words.
- "lines": two to four lyric lines from inside the song. Lines only, no labels.
- "note": empty unless something needs saying in one short line.`);
  return blocks.join('\n\n');
}

/** One idea, reworked to his note. What he marked to keep comes back word for word. */
export function reworkPrompt(input: {
  idea: { title: string; concept: string; lines: string[] };
  feedback: string; keepTitle: boolean; keepConcept: boolean; keepLines: string[]; changeLines: string[];
  direction: string; shape: string; references: string;
}): string {
  const blocks: string[] = [];
  blocks.push(`An idea he is reacting to:\nTitle: ${input.idea.title}\nConcept: ${input.idea.concept}\nLines:\n${input.idea.lines.map((l) => `- ${l}`).join('\n')}`);
  if (input.direction.trim()) blocks.push(`His general direction for ideas:\n${input.direction.trim()}`);
  if (input.references) blocks.push(input.references);
  if (input.shape) blocks.push(input.shape);
  const keep: string[] = [];
  if (input.keepTitle) keep.push('- the title, exactly');
  if (input.keepConcept) keep.push('- the concept, as it is');
  for (const l of input.keepLines) keep.push(`- the line "${l}", word for word`);
  if (keep.length) blocks.push(`He likes these. Keep them exactly:\n${keep.join('\n')}`);
  if (input.changeLines.length) blocks.push(`He wants these lines changed:\n${input.changeLines.map((l) => `- "${l}"`).join('\n')}`);
  blocks.push(`His note:\n${input.feedback.trim() || '(no note: rework what he did not mark to keep)'}`);
  blocks.push(`How to answer
- Rework this one idea to his note. Keep what he marked; change what he asked; leave the rest as it is unless his note reaches it.
- An adult narrator and an everyday situation, unless his note says otherwise.
- "title", "titleParts" (one or two chunks that join back into the title exactly), "concept" (at most 45 words), "lines" (two to four lyric lines; kept lines included, in their places).
- "note": empty unless something needs saying in one short line.`);
  return blocks.join('\n\n');
}

/** More lines for a song page: things he can tap into his draft. */
export function moreLinesPrompt(input: { title: string; concept: string; onPage: string[]; draft: string; ask: string; avoid: string[]; references: string }): string {
  const blocks: string[] = [];
  blocks.push(`The song: "${input.title}"${input.concept ? `\nWhat it's about: ${input.concept}` : ''}`);
  if (input.onPage.length) blocks.push(`Lines and fragments already on his page:\n${input.onPage.map((l) => `- ${l}`).join('\n')}`);
  if (input.draft.trim()) blocks.push(`His draft so far:\n${input.draft.trim()}`);
  if (input.references) blocks.push(input.references);
  if (input.avoid.length) blocks.push(`Lines you've already offered (don't repeat them or near-copies):\n${input.avoid.map((l) => `- ${l}`).join('\n')}`);
  blocks.push(`What he wants now:\n${input.ask.trim() || 'More lines for this song: ones he could build a chorus or a verse around.'}`);
  blocks.push(`How to answer
- Give six lyric lines for this song, each one usable on its own, in the narrator's voice. Lines only, no labels. If he asks for a couplet or a chorus, a line can be one of the lines of it; keep them in singing order.
- Vary them: a blunt admission, a concrete detail, a hook-shaped line, a line that answers one already on the page.
- "note": empty unless something needs saying in one short line.`);
  return blocks.join('\n\n');
}
