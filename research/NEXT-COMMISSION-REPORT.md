# Report for the next commission (19 Oct 2026)

Answering the 19 Oct "next research and integration commission". Four things are kept apart below, as asked: what was built, what was learned, what the app has actually used, and what has been shown to help. The last is empty until Sam judges.

## 1. Completed implementation

| Deliverable | Where | State |
|---|---|---|
| Corrected, versioned pack + change log | `research/pack/` (pilot-1.2), `research/CHANGELOG.md`, `research/build_pack_v2.py` | Live. 95 quotations checked against raw pages (42 verbatim; the rest never rendered as quotes); AA-S2/PA-S1 reconciled; the C45 snippet claim removed; claim type, access, confidence and claim-specific limits labelled separately; 8 room-only cards never sent to the writer; 6 lopsided teaching pairs repaired; every profile states what it rests on. History kept (the loader takes the newest version of each record). |
| Baseline | `research/BASELINE-2026-10-19.md` | Recorded from the code and the live settings before any change. |
| One research boundary, per-route switches | `Service.research()`, `selectForRoute`, Settings → Writer → "By task (experiment)" | Live. Defaults unchanged. |
| Route-by-route integration table with traces | `research/INTEGRATION.md`, `research/TRACES.md` | Fixture and real traces for Ideas, Create, Develop, Journal rewrite, Journal continue, Find the title; the Hang never receives notes. |
| Create carries the reference's characteristics | `POST /messages` with `refId` | Live. |
| Several references at once | `server/engine/refsplit.ts`, `ref2` lookup, the reference card | Live and checked on the phone-sized live build with "Noah Kahan, Sam Fender": two cards, each with its own optional note and "Not this one". |
| Run records | `runs.request.pack`: route, mode, version, ids, reasons, rendered block, hash; plus prompt version, model, effort, generation id | Live, private to the app. |
| Eight song records, justified cards, improved profiles | `research/SONGS-2026-10-19.md`, `research/raw/songs-*/`, `research/pack/candidates/` (pilot-1.3-candidate) | Staged, **not loaded** (to be compared only after the route test). |
| Taste: what the 16 answers changed; kept / rejected / waiting; five quick pairs; accepted edits | `docs/TASTE-CHAIN.md`, Settings, `#/taste/contrasts`, `GET /songs/:id/edits`, `songHistory` (off) | Live. |
| Eight-brief evaluation with immutable mappings | `research/eval/2026-10-19-research-test.md`, live batch `tb_XwF3_TE7`, `#/trials/tb_XwF3_TE7` | Generated on the real writer ($1.21). **Unjudged.** |

Tests: 114 automated (`npm test`), including production-parity checks for the test's frozen prompts; a 19-check browser journey for the new screens (`tests/journeys/research_journey.py`).

## 2. New knowledge

- Eight songs examined as whole works (with partial lyric access for six, and paraphrase-only access for two). The strongest new distinction rests on a documented rewrite (Sam Fender moving the chorus off the narrator); four others are documented statements or observable features (one qualifier carrying the confession; a title that is an unfinished sentence; polite-to-blunt chorus order; opening a loss song through grammar).
- C43's "the chorus tells the whole song" now has two documented counterexamples, which is a limit, not a reversal.
- Sam Fender now has a profile (candidate), and Noah Kahan's profile says what it does not cover (2023–26).
- The research environment cannot reach a licensed lyric display (Musixmatch and LyricFind refuse the fetch tool), and has no audio. Whole-song analysis is therefore partial or paraphrase-only; that is recorded per record, not hidden.

## 3. Observed runtime use

In his real use since 9 Oct (about 86 writer calls outside tests and previews), research reached the writer **3 times**: all Journal rewrites on "Tamagotchi" ("keep the rhythm, more bratty"), each with cards C15 and C17 under the default "precise edits only" setting. He kept one option from those sets. That is use, not evidence of help. Ideas, Create, Develop, Continue and Find the title have never had research in his use.

The taste test's 16 answers changed nothing on their own; five findings are waiting for his call; the two songs he marked as his are in every prompt as voice examples since 19 Oct, 19:53 PT (`docs/TASTE-CHAIN.md`).

## 4. Demonstrated improvement

**None yet.** The eight comparisons are written and waiting for his judgment. The only earlier evidence is the 10 Oct blind test: overall a wash (5 / 7 / 6, 4 none); the craft-notes version won 3 of the 4 precise-edit trials, a lean from a tiny sample with a possible position effect.

## Recommended default per task (today)

| Task | Default | Status |
|---|---|---|
| Ideas | off | unjudged |
| Create | off | unjudged |
| Develop an idea | off | unjudged |
| Journal rewrite | on, as before (legacy "precise edits only": up to 2 cards, matching profiles, 1 teaching pair) | the 10 Oct lean; unjudged on the route-only pack |
| Journal continue | off | unjudged |
| Find the title | off | unjudged |
| Hang | never | by design |
| Song history (his earlier edits to the same song) | off | untested |
| Expanded pack (pilot-1.3-candidate) | not loaded | untested |

Nothing changes until Sam's votes say so, and then only for the task they support, by the per-task switch, with his decision recorded in `docs/DECISIONS.md`.

## Unresolved gaps

- Retrieval misfires seen in the traces: matches on format words alone (E1 "good"; E4 and E8 the title tag), "falling in love… won't work out" read as a happy love song (E3), "in place of" read as a place (E5). Not tuned before the test, deliberately. If the votes on these don't favour research, fix retrieval before adding research.
- The taste test's five findings are waiting; until he decides, the writer reads none of them.
- Repaired pairs E05, E06 and E08 now explain their new sides; no pair has a judgment from Sam yet (five are offered in `#/taste/contrasts`).
- Whole-song lyric access is paraphrase or partial everywhere; no audio anywhere.
- The "Better For Her" outside session was not supplied; only the Songroom revisions are on record.
- The judging screen was checked on the stand-in at 320/393 wide, dark and desktop, and the other new screens on the live build at 393×659; the judging screen itself was not opened on the live build so that Sam's first view of each comparison is the one recorded.

## What the next commission should do first

1. Read Sam's eight verdicts (`GET /api/trials/tb_XwF3_TE7/tally`), then repeat two or three of them (same frozen prompts, sides flipped: `POST /api/trials` with `repeatOf`) to see how much of any difference is just variation.
2. Fix retrieval where the traces show misfires, and re-run only the affected cases.
3. Only then compare pilot-1.2 with the pilot-1.3 candidate, everything else fixed; separately, test `songHistory` off/on.
