# How the app uses the research (integration notes, 10 Oct 2026)

Plain-English version first, mechanics after.

## What changed in the app

1. **The writer's standing instructions were corrected (prompt p2.0).** The 9 Oct prompt told the writer that every song idea is "a situation with a turn", that the title should get "a second weight by the end", and that a concrete domestic detail is always better than naming the feeling. That is one good way to write a country song and a bad default for pop. p2.0 lets an idea be a hook with an attitude, a feeling, a question, a stance, an image, a character or a story, and says: use the shape the brief asks for. Options come back as lines only. If Sam names a reference the writer doesn't know, it now says so in one line instead of inventing it.
2. **The research pack is available but off by default.** Settings → Writer → "Use craft notes from the research pack". When on, each request gets at most two short craft notes that fit it, a reference profile when Sam names an artist the pack knows, and (for line work) one original teaching pair. Never the research itself, never a lyric, never more than a few hundred words.
3. **A blind comparison screen** (Settings → Experiments) runs the same fresh brief three ways and hides which is which until Sam picks.

## What was NOT built, on purpose

- No vector database, no embeddings, no agent framework, no new hosting. The pack is JSONL in the repo; retrieval is keyword and tag matching you can read in `server/engine/pack.ts`.
- No live lookup of unknown references inside the app. The app's writer call sends no tools. The smallest honest next step, if Sam wants it: on the reference-resolution step only, make one server-side web-search tool call with a per-request budget, and store the result as a reference note with its URL and date. Everything else (card writing, verification) should stay a human-reviewed job, not an automatic loop.
- No automatic promotion of the pack into the default. That waits for Sam's votes.

## Mechanics

- `research/pack/manifest.json` carries the pack version (`pilot-1`). `cards.jsonl`, `profiles.jsonl`, `pairs.jsonl` are retrievable; `sources.jsonl` is provenance only.
- `loadPack()` runs at boot. `selectPack({ text, brief, reference, task })` scores every card: +3 per matched direction tag (humour, rhyme, attitude, bridge…), lower weights for format tags that appear in nearly every request (title, concept, angle), +2 for a named genre, +1 for task fit (and −4 for a card not meant for that task), up to +3 for word overlap with the card's problem statement, −2 for low-confidence cards. Threshold 3, at most 2 cards. Negated directions ("not a breakup song") are stripped before matching. Profiles match by name or alias, accents ignored. A pair is added only for line and edit work and only if it is linked to the top card and not reserved for evaluation.
- `renderPack()` writes the block: "Craft notes from working writers (lenses, not rules; his instruction and his own lyric always win; never mention these notes; do not make the writing sound studied…)" followed by `problem → technique. Not when: …` per card. The block goes in the user turn, after the song and the reference and before the request, so the cached system prompt is unaffected.
- Every run stores `prompt_version` (`p1.1`, `p2.0`, `p2.0+pack`) and `request.pack = { version, cards, profiles, pair }`, so any regression can be traced to the records that were in the prompt.
- Limits live in `PACK_LIMITS` (`cards: 2, profiles: 2, pairs: 1, minScore: 3`). Adjust through the Experiments screen, not by intuition.

## Known limits of the retriever (honest list)

- Keyword matching misreads some briefs: "singable" used to fire the rhythm cards; "not a breakup song" used to fire the breakup cards. Both are handled now, but new phrasings will find new gaps. When a wrong card appears, the fix is a one-line hint or a card tag, not a new system.
- For ideas requests the same two or three generic cards (topic vs angle, keep the flinch line) will recur unless the brief names a direction. That is acceptable: those are the lenses that matter for ideas.
- Zero cards is a valid outcome and happens for opinion questions and literal edits (which never reach the writer anyway).

## How to extend the pack

1. Put raw findings in `research/raw/<slice>/` in the agent format (see `raw/AGENT_STANDARDS.md`); every finding carries an evidence label and a locator.
2. Add cards in `research/build_cards.py` (one `card(...)` call each; cite finding and source IDs; write the `when_not`), rebuild with `python3 -I research/build_cards.py`, run `npm test` (the pack test checks every reference resolves).
3. Bump `pack_version` in `manifest.json` when the retrievable files change in a way that could change writing, so runs can be compared across versions.
4. Never add a lyric line. Never add a card whose only evidence is "it's in a hit".
