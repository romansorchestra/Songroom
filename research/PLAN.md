# Songroom research — plan and audit (10 Oct 2026)

Assignment: `docs/` has the product spec; the research brief Sam supplied on 9 Oct 2026 is the authority for this folder. This file records the Phase A audit and the plan actually followed. It is a working document; later phases append to it.

## 1. Audit of the current generator (prompt p1.1, commit a5a3385)

What runs today, from `server/engine/prompts.ts`, `server/service.ts`, `server/engine/writer.ts`:

- Model `claude-opus-5-5`, effort `high` for creative and edit tasks, structured JSON output, system prompt cached. Max output 24k tokens (write), 12k (edit).
- Context sent: SYSTEM_CORE + Sam's taste notes + up to 4 voice examples (chosen by a keyword match between the request and each example's "direction" label) + song title/brief/lyric + last 14 session messages (compacted) + free-text reference + the request.
- References: a free-text field passed as "qualities, don't imitate". There is no lookup path. If the writer does not know a reference (ADÉLA was unknown in the session Sam reported), nothing resolves it.
- Output: `ideas` (title, concept, lines), `options` (lines), `draft`, `reply`. No per-option explanation field exists, which is good; explanation can only leak through `reply` and `concept`.

Instructions in SYSTEM_CORE that work against a contemporary pop brief (these are the "wrong task" the brief warned about):

1. "A song idea is a situation with a turn: who is singing, to whom, and what they realise or can't admit." — every idea is forced into a realisation narrative. A hook-, attitude- or feeling-led pop idea has no "turn" and is pushed toward one.
2. "The title is the hook… which the song gives a second weight to by the end." — a title-reinterpretation convention (strong in Nashville writing) applied to everything.
3. "Specific beats general. A concrete object, action or habit that shows the feeling…" — the revealing-domestic-detail convention stated as universal. It is one of several ways a line can work.
4. The one-line genre stereotypes ("plain-spoken and turn-driven for country; conversational and hook-first for pop; rhythmic density, internal rhyme and character for hip-hop").
5. Sam is introduced as having cuts "across pop, country-leaning pop and singer-songwriter records", which quietly tilts every unnamed brief toward country-leaning pop.
6. `ideas.concept` is always required and the schema has no shape for "hook + stance + situation" ideas, so the writer must write a concept paragraph even when the idea is a phrase and an attitude.
7. Nothing in the write path carries a melody shape, rhyme target or "what the line must mean" across turns; Sam re-types them. (The edit path is better: targets, syllables/stress guidance, rhyme guidance added in p1.1.)

What is already good and should be kept: the edit path's scope protection, the rhyme guidance in `editPrompt`, "small requests stay small", "don't praise, don't explain wordplay", the constraint checks in code, the hard rule against reproducing lyrics or doing artist impressions.

## 2. Capabilities actually available here vs in the deployed app

Research environment (this session): web search works; page fetch works for most press and magazine sites; genius.com and similar lyric sites are blocked (recorded, not worked around); Song Exploder publishes episode transcripts as PDFs, which fetch; YouTube/video is not accessible, so interview videos are used only when a text transcript or write-up exists; no audio at all — every rhythmic or phonetic note in the collection is provisional and labelled as text-only. Persistent storage: this repo (`research/`), committed to GitHub.

Deployed app: no search or fetch tools at all. The Anthropic API call sends no tools. So "lookup an unfamiliar reference" is impossible in the app today; the integration notes propose the smallest change (an optional server-side web-search tool call on the reference-resolution step only, behind a budget) rather than building it in this assignment.

No Anthropic API key is available in this research environment. Live-writer tests run through the deployed app only.

## 3. Storage format

Plain JSONL + Markdown in `research/`, committed with the code. No database, vector store or new service. Schemas in `research/SCHEMA.md`. The app loads `research/pack/*.jsonl` at boot and selects a few records by tag/keyword match (Phase C).

## 4. Pilot sample (Phase B)

Research cutoff: 10 Oct 2026. Discovery window for contemporary material: Oct 2024 – Oct 2026, plus enduring older examples and Sam's own references. Release dates are verified per song; where a chart is used the chart, territory and week are named.

Contemporary pop first (target 12–16 songs): Sabrina Carpenter ("Please Please Please", "Espresso", "Manchild"), Chappell Roan ("Good Luck, Babe!"), Billie Eilish ("Birds of a Feather"), Gracie Abrams ("That's So True"), Lola Young ("Messy"), Charli XCX ("Girl, so confusing"), Tate McRae, Addison Rae, Alex Warren ("Ordinary"), Olivia Rodrigo (GUTS and anything newer), ADÉLA (PRIMA, 2026, resolved: Adéla Jergová, Bratislava; Capitol; exec-produced by Dylan Brady and Blake Slatkin), Amy Allen (as co-writer and as artist). Comparison groups: Morgan Wallen and his writers' room; Ed Sheeran (Play, 2025); Tyler, the Creator (CHROMAKOPIA / later); narrative singer-songwriter (Noah Kahan, Hozier). Sources: 6–10 substantive interviews/transcripts (Song Exploder PDFs, NPR transcripts, long-form press profiles, writer-podcast write-ups), verified credits from official/label or reputable database pages.

Budget: research is done with this session's own tokens. Live-writer tests are capped at $5 total on Sam's key (the app's own $10/day cap also applies). Stop rules per the brief: blocked source → record gap, move on; repeated low-value evidence → stop that hunt.

## 5. Phases

A. Audit + plan (this file). B. Pilot collection → `research/pack/`. C. Prompt p2.0 (task/output fixes, no research) and p2.0+pack; blind three-way experiment on fresh briefs with repeats, run on the live writer; judging screen in Settings → Experiments. D. Expansion where gaps show. E. Handoff: `research/SUMMARY.md`, `research/INTEGRATION.md`, counts, what was verified/inferred/tested/unjudged.
