# Build status (10 Oct 2026)

## Works (verified)
- Write: ideas / lines / drafts / conversation, references, "more like this", session history, recoverable after refresh, unsent text kept locally.
- Journal: seeds, single lines, songs; search; filters; star; edit; delete (songs from a seed survive).
- Song page: sections with stable line IDs, tap-to-select lines and words, locks, direct literal edits, writer-assisted edits with before/after, free-text editing, drafts, full version history with restore, conflict protection.
- Suno: style + exclude + per-section tags around exact lyrics; stale warning when lyrics change.
- Settings: model and thinking level, spend caps and receipts, taste notes and example lyrics, 12-brief test pack with judging, blind Experiments screen (prompt versions and research craft notes), craft-notes toggle, JSON + Markdown export, sign out.
- Research pack (10 Oct): `research/pack` — 552 sources, 56 craft cards, 16 reference profiles, 16 original teaching pairs; loaded at boot; keyword retrieval; see `research/SUMMARY.md` and `research/INTEGRATION.md`.
- Tests: 35 automated (lyric safety, locks, conflicts, duplicates, spend cap, Suno verbatim, no-writer state). Full browser flow at iPhone size, light and dark, plus desktop, using the labelled stand-in writer.

## Live
- https://songroom-qyvq.onrender.com (Render, $7.25/mo). Test pack run on real Opus 5.5 on 9 Oct: 12/12 succeeded, every hard check passed, $0.33 total. Results are in Settings → Test pack for Sam to judge.

## Not yet verified
- Real iPhone Safari (keyboard, selection, home-screen install).

## Deferred
Research worker (live lookup of unknown references from inside the app), inferred taste rules, generated artwork, voice memos, restore-from-backup UI, print view, GPT-6 Astra adapter.
