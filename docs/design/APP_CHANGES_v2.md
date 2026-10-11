# Songroom — Changes after the first real writing session

For Sam and the Claude Code builder · 9 October 2026 · Draft v2.0

**This is a change brief for an app that already exists. Inspect that app before editing it. Do not rebuild from the earlier handoff.** The reported problems and functional requirements below are grounded in Sam's first session. The design proposal is a direction for discussion, not an approved visual specification. Preserve all existing lyrics, notes, references, feedback and history.

## 1. What happened, and what needs to improve

Sam used the app during a professional co-writing session. The melody was largely established; people were trying words against a repeating musical section. He needed suggestions that fit the developing meaning, rhythm, syllables and rhyme. Occasionally the app supplied an unexpected rhyme or phrase he could use, particularly after he pasted relevant reference lyrics. That is the useful behaviour to build around.

The reported problems:

- A prompt produced several ideas, and follow-ups accumulated into a long, confusing stream. Changing to another idea did not create a clear working boundary.
- Suggestions included too much commentary and explanation. Usable phrases were buried in output.
- The app interpreted a reference as Adele when Sam meant ADÉLA, associated in his description with an album called Prima. After his correction it could not research the intended artist. Verify those details; do not treat this description as independently researched metadata.
- Broad pop requests produced elaborate narrative concepts, such as an airport story with a setup and later reversal. Sam found this poorly matched to the requested direction, not proof that narratives are universally bad.
- He repeatedly had to restate the current line, rhyme and evolving meaning.
- The yellow lined paper and handwriting treatment was not enough to produce the illustrated personal journal he imagined. Writing-session usability matters before decorative polish.

**Goal:** make useful material easier to find, steer and try against a melody, while retaining a separate place for collecting ideas without a song in progress.

## 2. Priorities and non-goals

Priority order:

1. Correct working context, short useful suggestions and precise edits.
2. Quick control of rhyme, rhythm and meaning, without repeated lengthy prompts.
3. Clear separation of songs, loose ideas and their alternatives.
4. Reliable references and relevant writing examples.
5. Journal presentation that rewards returning to saved ideas.

Keep Write and Journal as the only main destinations. Do not add a professional dashboard, elaborate taste-rule engine, social collaboration system or new infrastructure merely to implement these changes. Retain the current stack if it can support them. Nothing here requires replacing the database or rebuilding authentication.

Do not discard the front-loaded craft research request. Implement a small interface for relevant research/examples; the companion research brief defines the content. Do not wait for the entire research collection before improving the session interface.

## 3. Proposed interaction: a song page with a phrase audition area

“Phrase audition” means Sam mentally sings or tries the suggested text; it does not imply generated audio.

### Desktop proposal

- Main area: the current lyric sheet, with the selected phrase clearly highlighted.
- Beside it: three or four compact alternatives for that phrase, using the surrounding line as context when useful.
- A short instruction field stays near the alternatives: “less sincere,” “make her the one leaving,” “keep the rhythm,” “rhyme with mine.”
- A compact context strip shows only relevant items, for example: **rhyme: mine · rhythm: current phrase · meaning: pretending not to care**. These are editable shortcuts, not a form that must be completed.
- “More” replaces the current suggestion set. Earlier sets remain under Previous; they do not grow down the main page.
- Pinned fragments sit in a small collapsible shelf attached to this song. Pinning is not accepting them into the lyric.

### Phone proposal

Keep the selected line and one or two surrounding lines visible above the suggestion area. Show alternatives as readable stacked strips, not a large chat transcript or freely floating objects. The composer and More control should remain reachable while the keyboard is open. Opening the complete lyric sheet or the fragment shelf should not lose the current selection.

Use restrained layout changes rather than words continuously popping around the screen. Fresh suggestions can appear with a subtle transition, but nothing moves while Sam is reading or reaching to tap it. No automatic cycling, countdown or audio output.

### Essential actions

| Action | Meaning |
| --- | --- |
| More | New alternatives for the same current target and constraints |
| Pin | Keep a phrase for later in this song; no change to accepted lyrics |
| Try | Preview the phrase in the actual line, preserving surrounding words |
| Keep | Commit that preview as a new lyric revision |
| Undo | Restore the prior text through revision history |

These are behaviours, not a requirement for five permanent buttons on every card. Keep the visible controls minimal; selection or a small menu can expose less-used actions. Test whether Try followed by Keep is too cumbersome; a preview with one clear confirmation is the requirement.

## 4. Two kinds of work within Write

### Find an idea

A blank request or broad brief produces a small, varied batch of title/concept/seed-line cards. Default to three ideas, respecting requested counts. Do not require a finished concept before offering a title, phrase or emotional angle that could become a song.

Opening an idea focuses it. “More like this” operates on that idea; it does not mix its follow-ups into unrelated ideas. The batch overview remains one step away. Saving sends it to Journal; developing creates or opens its linked song. Unsaved batches remain recoverable in session history.

The concept field should explain the playable emotional idea in one or two plain sentences. It need not be a miniature plot synopsis. Depending on the brief, an idea may be a stance, accusation, desire, image, social observation, rhythmic phrase, character or contradiction.

### Work on a song

Open a song, select a phrase or line, and get alternatives. The app should not default to title/concept cards when Sam is solving a line. It can offer words, short phrases, full lines or a two-line setup/payoff according to the selected span and request. Never fill the screen with a whole verse when he selected three words.

These are contextual behaviours. Avoid an extra mode-selection questionnaire. Opening a song or selecting text should establish the task naturally.

## 5. Keep the session context current

Store a small current context for each song:

- Accepted lyric revision and selected line/span.
- Narrator, addressee and the current emotional meaning.
- User-confirmed story facts; provisional interpretations labelled separately.
- Active references and the characteristics Sam wants from them.
- Rhyme target and scope: exact ending, rhyme family or permitted slant rhyme.
- Rhythm reference: a sample phrase, marked stresses or an explicitly supplied syllable target.
- Current instruction and pinned material, used only when relevant.

Accepted text is authoritative. A chat summary cannot overrule it. A local experiment such as “make this angrier” should not permanently change every song's voice. “More” inherits the active constraints; “start a different idea” creates a distinct context.

When Sam changes the line that supplied the rhyme target, indicate that the old target may be stale. Where the target is explicitly linked to that line, update it visibly; where it was manually fixed, preserve it until changed. Never silently use an obsolete ending. Suggestions retain the revision and constraints they were generated against.

Short instructions should update only their relevant part of the context. If the instruction is materially ambiguous, ask one concise question. Do not make Sam approve an entire analytical summary on every turn.

## 6. Rhythm, rhyme and output behaviour

The app does not know the rhythm just because it has the text. Let Sam supply a working phrase whose shape should be retained; optionally mark stresses by emphasis. Use approximate syllables and sound patterns as assistance, with an easy manual correction. No mandatory syllable counting UI.

Separate exact constraints from judgments:

- Exact constraints: selected edit scope, unchanged surrounding text, locked lines, exact ending words, forbidden words and requested line count.
- Judgments: sung stress, vowel comfort, rhythmic feel, naturalness of a slant rhyme and whether the line emotionally lands.

Validate exact constraints in code; do not claim that heuristic phonetics prove melodic fit. Match rhyme by sound, including multisyllabic/phrase rhyme when useful, rather than spelling. Prefer meaning and natural syntax over a technically matching rhyme that makes the character sound strange.

Default response during a session: **three or four alternatives, just the words**. No praise, rationale, genre lecture, multiple headings or unsolicited verse. A short explanation belongs behind “Why?” or in response to an explicit question. A constraint conflict can receive one short explanation rather than falsely compliant output.

Generate genuinely different approaches, not paraphrases of the same sentence. Include straightforward alternatives where suitable; every candidate need not be a punchline. Preserve the requested register, bluntness, humour and emotional intensity instead of smoothing everything into polite generic language.

Literal, unambiguous replacements can be performed directly without a model call. Creative suggestions remain proposals until accepted.

## 7. Reference resolution and useful personalisation

One optional reference input should accept an artist, song, album, link or user-pasted text. Correct identity matters before style analysis. On an ambiguous name, show concise candidates; on a user correction, discard the mistaken identity and its inferred characteristics. Do not carry Adele's presumed attributes into an ADÉLA session.

Inspect which tools the deployed app actually has. Claude Code's research capabilities do not automatically exist inside the deployed app. Implement and test a server-side search/retrieval route or show an honest unavailable state. A streaming URL alone does not give access to its full lyrics/audio.

Resolve a reference once, cache the verified metadata/analysis with dates, and let Sam reuse or correct it. A specific song reference overrides a broad artist interpretation for that request. Save source-backed analysis separately from model inference. Never manufacture lyrics, quotations or artist commentary.

For requests such as “US Top 40,” establish the intended chart/date when necessary, or disclose the chosen basis briefly. If live data is unavailable, say that the direction is general contemporary pop rather than pretending to have checked today's chart.

Provide an unobtrusive examples collection: Sam's chosen writing, accepted phrases and original-to-rewrite pairs, scoped by project/direction. Retrieve a few relevant examples, not his entire catalog. Save reasons when volunteered. No mandatory ratings after every action. A pinned phrase is weaker evidence than an accepted lyric; ignored suggestions are not dislikes. Do not turn one rejection into a permanent taste rule.

## 8. Journal design proposal — distinct from the work surface

The session surface should be crisp and readable. The Journal can feel like a personal illustrated book: warm off-white paper, occasional handwriting, small original drawings, marginal notes and carefully placed fragments. Avoid putting every screen on yellow ruled paper in the same handwriting font.

Suggested page hierarchy: title; a small illustration or motif; the concept; selected seed lines with room to breathe; Sam's notes or revisions in a secondary treatment. Multiple related fragments may share a spread if their relationships remain clear. Do not jumble unrelated songs to make an attractive collage.

Handwriting is optional and remains selectable text. Offer a clean reading view. Artistic page layout must not reorder lyrics or hide their latest accepted version. Store the page's design so it does not change on refresh. Artwork generation is an explicit later action; failed artwork never affects saved writing.

Save an idea, a single line or a whole song without forcing tags. Journal search and a small set of collections are enough. A decorative journal page is a presentation of real editable records, not a flattened image that traps the words.

## 9. Audio: optional experiment, not the next dependency

Sam prefers typing discreetly and receiving text during sessions. Do not require spoken commands. Do not introduce always-on or covert room recording as a default solution.

If audio is tested later, use an explicit short capture of the intended phrase, an unmistakable recording indicator, appropriate participant consent, and a correctable result. Test against real sung placeholders and accompaniment before promising rhythm extraction. Treat inferred words and musical timing separately. Audio must not automatically decide that a remark in the room is an accepted lyric or override typed context.

The next iteration must work well with typed sample phrases alone. No feature should claim to understand a melody it has not actually analysed.

## 10. Implementation sequence

1. **Inspect and reproduce.** Examine current prompts, context assembly, reference tools, generation formatting and persistence. Use a copy of representative session data. Record what is actually implemented, not what an earlier plan said should exist.
2. **Fix context and output first.** Separate idea/song work, remove unsolicited commentary, retain rhyme/rhythm/meaning, bind proposals to revisions and implement narrow replacements.
3. **Prototype the focused surface.** Show a phone-sized and desktop-sized example using fixture text. Compare the proposed fixed suggestion strips against a one-at-a-time alternative before final visual work. Label fixtures.
4. **Implement the chosen interaction.** Preserve batches under history, pin fragments, preview in context, and keep independent idea/song contexts.
5. **Connect references and examples.** Add verified lookup where available and retrieval of a small relevant example pack. Integrate research records through the simplest existing storage boundary.
6. **Polish Journal separately.** Present two page treatments before committing to handwriting/illustration density. Do not delay the session fixes for art.

No model/provider or framework migration is required by this document. Keep existing private access, server-side secrets, backups, spend limits and honest failure states. Ensure background generation behaviour fits the deployed server's lifetime; do not assume a browser staying open is necessary or sufficient.

## 11. Acceptance checks for this iteration

- A request for a replacement phrase returns short alternatives, not a new song or essay.
- After several rounds of More, the active screen remains compact; previous suggestions remain recoverable.
- Switching between two ideas preserves their separate directions, lines and instructions.
- Correcting a reference removes the mistaken interpretation. Unavailable research is labelled accurately.
- A change in narrator, meaning or rhyme carries into the next batch without retyping the whole brief.
- A phrase replacement cannot alter text outside the selection. Locked text survives malformed model output.
- Pin, preview and accept are distinct; nothing enters the accepted song accidentally.
- Suggestions generated against an older revision cannot silently overwrite newer edits.
- Saving and retrying do not duplicate journal entries or paid requests.
- A failed provider call leaves the lyric and last useful suggestion batch intact.
- On a phone, the open keyboard does not hide the selected phrase or the essential controls.
- Reference/example context is limited and relevant; current explicit instructions win over old preferences.
- A pop request can produce direct, attitude-led or hook-led material without imposing a plot twist.
- Printed/clean Journal text preserves exact line breaks and remains readable.

Test these through meaningful automated checks for text preservation and persistence, plus an actual writing session for speed, usefulness and musical fit. Screenshots alone cannot establish that the writing improved.

## 12. Design questions to settle with Sam

These are open choices, not blockers to inspecting the app and fixing output/context:

1. **Alternatives together or individually?** Recommended starting point: three/four stable strips together; alternative: one large phrase at a time with quick previous/next.
2. **Default granularity?** Recommended: follow the selected span, while permitting a switch between end-word, phrase and whole-line suggestions.
3. **Journal character?** Recommended: restrained illustrated notebook with occasional handwriting; alternative: a more expressive scrapbook of fragments and marginal notes.

Bring concrete examples to this discussion. Do not make Sam choose among dozens of settings. The design should help him hear and compare possibilities, not merely decorate a transcript.

## Builder deliverable

Implement agreed functional changes in the existing project, show the proposed interaction before locking the visual treatment, and report what was checked. Keep a concise list of approved design choices versus proposals. Do not claim the research library or audio understanding exists until it is actually connected and tested. Use the companion research prompt for the separate craft-research workstream.
