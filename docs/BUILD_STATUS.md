# Build status (10 Oct 2026)

## The approved design (10 Oct, `docs/design/`)
Built to `APPROVED_DESIGN_SPEC.md` and `APP_CHANGES_v2.md`. Checked offline with the labelled stand-in writer only: layout at 320, 393, 430, 768 and 1440 wide and dark mode (no sideways scroll, nothing off the edge), and the behaviour tests below. None of this says anything about writing quality; that depends on the model and prompts, which are unchanged pending Sam's blind votes.
- Write is a springboard: one idea at a time (title strips, short concept, a first thread), his own fragments, Save idea / Start writing, Previous / Recent / Another idea. Ideas come three per paid request; refreshing never spends. He can type his own starting line instead.
- Song workspace: one plain editable lyric sheet; select lines and ask; one suggestion at a time with Previous / Another / Keep; only Keep changes the lyric, and only the selected span; Undo. Starting points sit beside the lyric until "Add to lyrics". Rhyme target (fixed or linked to a line), rhythm and meaning carry forward and are visible.
- References: checked against the research pack first, then a web search, else an honest "couldn't check"; ambiguous names offer a choice; "Not this one" removes it everywhere.
- Journal: All / Ideas / Fragments / Songs, search. Earlier sessions still open from Recent.
- Model choice stays in Settings and is recorded per run; nothing in the interface or saved writing depends on it.

## Works (verified before the redesign)
- Write: ideas / lines / drafts / conversation, references, "more like this", session history, recoverable after refresh, unsent text kept locally.
- Journal: seeds, single lines, songs; search; filters; star; edit; delete (songs from a seed survive).
- Song page: sections with stable line IDs, tap-to-select lines and words, locks, direct literal edits, writer-assisted edits with before/after, free-text editing, drafts, full version history with restore, conflict protection.
- Suno: style + exclude + per-section tags around exact lyrics; stale warning when lyrics change.
- Settings: model and thinking level, spend caps and receipts, taste notes and example lyrics, 12-brief test pack with judging, blind Experiments screen (prompt versions and research craft notes; 22 trials judged by Sam on 10 Oct), craft-notes scope (off / edits only / everything, default edits only), JSON + Markdown export, sign out.
- Research pack (10 Oct): `research/pack` — 552 sources, 56 craft cards, 16 reference profiles, 16 original teaching pairs; loaded at boot; keyword retrieval; see `research/SUMMARY.md` and `research/INTEGRATION.md`.
- Tests: 54 automated (19 for the redesign in `tests/studio.test.ts`); before that 35 (lyric safety, locks, conflicts, duplicates, spend cap, Suno verbatim, no-writer state). Full browser flow at iPhone size, light and dark, plus desktop, using the labelled stand-in writer.

## Live
- https://songroom-qyvq.onrender.com (Render, $7.25/mo). Test pack run on real Opus 5.5 on 9 Oct: 12/12 succeeded, every hard check passed, $0.33 total. Results are in Settings → Test pack for Sam to judge.

## Not yet verified
- Real iPhone Safari (keyboard, selection, home-screen install).

## Deferred
inferred taste rules, generated artwork, voice memos, restore-from-backup UI, print view, GPT-6 Astra adapter.
