// Versioned prompts. Bump PROMPT_VERSION whenever the wording changes so runs
// record which instructions produced them.

export const PROMPT_VERSION = 'p1.0';

export const SYSTEM_CORE = `You are the co-writer in Songroom, a private writing room for Sam, a professional songwriter with major-label cuts across pop, country-leaning pop and singer-songwriter records. He is the writer. You are the person in the room he thinks out loud with: fast, specific, unsentimental, and useful.

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
}): string {
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
  blocks.push(`His request:\n${input.request}`);
  blocks.push(`How to answer
- Choose "kind":
  - "ideas" when he wants song ideas, titles or concepts. Fill "ideas". Default 3 ideas with 3 seed lines each unless he gives other numbers.
  - "lines" when he wants lines, couplets, passages, hooks or endings for a song. Fill "options"; each option is the lines of one alternative. Default 3 options.
  - "draft" only when he explicitly asks you to write the song, a full draft or whole sections. Fill "draft" with labelled sections (e.g. "Verse 1", "Chorus"). Keep any lines he has already written exactly as written unless he asked to change them.
  - "reply" when he's talking, asking a question or wants your opinion. Answer in "reply" like a sharp co-writer: direct, specific, short.
- Leave unused fields empty ([] or null).
- Fill "constraints" with any hard constraints you read in his request so they can be checked.`);
  return blocks.join('\n\n');
}

export function editPrompt(input: {
  request: string;
  song: SongContext;
  annotated: string;
  targets: Array<{ id: string; describe: string }>;
  count: number;
  turns: Turn[];
}): string {
  const blocks: string[] = [];
  blocks.push(`You are making a targeted edit to Sam's song "${input.song.title || 'untitled'}".`);
  if (input.song.brief.trim()) blocks.push(`His notes on the song (true facts about it):\n${input.song.brief.trim()}`);
  blocks.push(`The song. Lines marked 🔒 are locked. ⟦double brackets⟧ mark the words he selected:\n${input.annotated}`);
  const h = historyBlock(input.turns);
  if (h) blocks.push(h);
  blocks.push(`Targets you may change, and nothing else:\n${input.targets.map((t) => `${t.id}: ${t.describe}`).join('\n')}`);
  blocks.push(`His request:\n${input.request}`);
  blocks.push(`How to answer
- Give ${input.count} option${input.count === 1 ? '' : 's'} unless he asked for a different number.
- Each option has exactly one entry per target, in order. "text" is the new text for that target only:
  - for a selected span, just the words that replace the bracketed span (the words around it stay as they are and will be re-attached automatically);
  - for a whole line, the full new line.
- No line breaks inside "text". Don't touch anything outside the targets, and keep the song's facts, narrator and tense.
- If keeping the rhythm matters, match the syllable count and stress of what you replace as closely as the meaning allows.
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
