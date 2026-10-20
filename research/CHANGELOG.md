# Research pack change log

Newest first. Every record keeps its history: the files hold each version of a card, profile or pair on its own line, and the app uses the highest version of each id (`latest()` in `server/engine/pack.ts`), leaving out any whose newest version says `"active": false`. Build order: `build_cards.py`, `build_profiles.py`, `build_pairs.py` write the v1 lines; `build_pack_v2.py` re-reads them and adds the v2 lines (run it after any of the others).

## pilot-1.3-candidate (19 Oct 2026) — staged, not loaded

The song-analysis round (Phase C): eight songs examined as whole works, in `research/raw/songs-{pop,ballad,country,songwriter}/`, staged by `python3 -I research/build_pack_v3.py` into `research/pack/candidates/`. The app does not load it. It is compared with pilot-1.2 only after the route-level test, with every other input fixed.
- 8 song records (`candidates/songs.jsonl`), 87 sources (5 duplicates marked), 55 findings.
- 7 new cards (C62–C68) for distinctions no card made; C43 gains a limit from two documented counterexamples (v3); 5 proposals declined as cards and kept as findings (reasons in `candidates/manifest.json`).
- Profiles: P01, P03, P13, P16 extended with their coverage rewritten; new P17 Sam Fender, P18 Lewis Capaldi, P19 Adele, P20 Sam Smith, each saying it rests on one song.
- No lyric stored beyond phrases of six words or fewer; no audio; lyric texts seen only through the fetch tool are labelled so, including press pages whose licence is not shown.

## pilot-1.2 (19 Oct 2026) — evidence hygiene

Asked for by the 19 Oct commission, Phase A. Built by `python3 -I research/build_pack_v2.py`.

**Quotations.** The fetch tool returns a model's summary of a page, not the page. A quotation seen only there is not a verified quotation.
- 95 quotations in the 127 findings were checked against the raw page in a real browser on 19 Oct (pages read in full; Song Exploder PDFs opened and searched as text). 42 were found verbatim (`verified_raw`); the other 53 stay `tool_extract_only` and are never rendered as quotations.
- 3 pages could not be rechecked and are recorded as such, not retried around their protection: CT-F12 (PressReader bot check), CW-F11 (Boston Globe paywall), PB-F14 (AOL page gone, 404).
- Cards C04, C18, C27 and C38 carried an unverified quotation in their rendered text; it is now a paraphrase. Any unverified quotation left in a card's example or effect is paraphrased by `unquote_unverified`. Per-quote status: `research/pack/quote_checks.jsonl`.

**Sources.** `research/pack/source_access.jsonl` (552 rows) records, separately for each source, how it was reached (`tool_extract`, `snippet`, `none`), what access the agent recorded, duplicates and the raw recheck.
- AA-S2 and PA-S1 were the same Song Exploder PDF logged twice, once as partial and once as full. Reconciled as one source (AA-S2); its full text was opened on 19 Oct.
- CT-S41 was a search snippet, never fetched. Its claim is removed from C45, which now rests on PB-S1, PA-S20 and ST-S44 (all fetched in full).

**Labels.** Each card now says, separately:
- `claim_type`: documented statement, observable feature, or analytical inference;
- `support`: per finding, its source, recorded access, confidence and quote status;
- `confidence`: unchanged scale;
- `limits`: what the claim cannot carry, in its own words (e.g. "stress claim: writer statement, not checked by listening"; "lexical; no audio needed"). This replaces the blanket "no audio" disclaimer.

**Who the advice is for.** `applies_to` separates advice for a person in a writing room from technique a generator can use.
- `session` (8, never sent to the writer): C03, C18, C21, C38, C46, C53, C54, C60.
- `both` (7, sent as a generator-ready rewording in `generator_technique`): C01, C04, C17, C35, C47, C49, C50.
- `generator` (41).
- `routes` says which writing actions a card is meant for (ideas, create, develop, rewrite, continue, title).

**Teaching pairs.** Six pairs were lopsided: one side failed the brief or was a strawman, so the comparison was on-brief vs off-brief, not a real choice. Each now has a competent, on-brief A side meeting the same constraints: E02, E05, E06, E07 (the A side now admits the checking, as the brief requires), E08, E16. Every pair's `analyst_view` begins "Analyst's view, not a correct answer". E05, E06 and E08 also have their explanation rewritten so it describes the new A side, not the strawman it replaced. Pairs are not part of the 19 Oct research on/off test.

**Profiles.** Every profile has a `coverage` line: which songs and eras it rests on and what it does not cover. The writer now sees it ("Coverage: Rests on …") so a whole artist isn't reduced to the two songs that were studied.

**Nothing removed from history.** No v1 line was edited or deleted. Old runs that recorded pilot-1.1 ids can still be read against the v1 records.

## pilot-1.1 (10–11 Oct 2026)

Adds `sam_judgments.jsonl` (Sam's 22 blind votes from the 10 Oct comparison). No card changes.

## pilot-1 (10 Oct 2026)

First pack: 552 sources, 56 cards (the commit message says 55; there are 56), 16 profiles, 16 pairs from 127 findings. See `SUMMARY.md`.
