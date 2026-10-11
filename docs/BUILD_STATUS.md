# Build status (10 Oct 2026)

## Sam's notes after using it (11 Oct)
He found it "actually pretty cool" and the suggestions "quite good", but the ideas were too high-concept ("Tamagotchi" read as a teen novelty). He asked for subjects grounded in what charts, a bigger New idea button, a way to react to an idea and have it reworked, and for a committed idea to become a page whose lines tap into a draft. Built:
- **Chart research** (`research/charts/SUMMARY.md`): every song that entered the Spotify US Top 50 from Oct 2023 to Oct 2026 (1,225; 292 hits), sorted by subject. Pop hits: 75% about a relationship, 60% sung to "you", under 10% high-concept.
- **Ideas**: each idea's subject is picked by the engine from that mix for the genre he chooses (chips on Write: Pop, Country, Hip-hop, Latin, Alt / rock, Any genre); adult narrators, everyday situations (template `p2.0/ws2`). The next batch is fetched ahead when the queue runs out, so New idea is instant.
- **Write screen**: a big New idea button; tap the title, the idea or a line to keep it (twice to mark a line for change); "What do you think?" reworks the idea to his note, keeps what he marked word for word, and the original stays one tap back; "Use this note for new ideas too" adds it to the direction.
- **Song page**: "Make it a page" opens a page of lines: the idea's lines, "More lines" on request (grouped by what he asked), his scraps. Tapping a line adds it to the draft below; the draft keeps select-and-change.
- **Rhyme** (11 Oct, later): prompt p2.1 makes rhyme expected; an idea's first lines are a rhymed four-line block; the engine checks by sound and sends weak blocks back once (see DECISIONS). Checked on the live writer through the preview route: see below.
- **Diary pop** lane (11 Oct, later): a genre chip built from the cohort research (`research/charts/COHORT.md`); its brief carries that lane's mix and register. Pop remains the default.
- Checked with the labelled stand-in writer at 320/393/430 wide (no sideways scroll); 59 automated tests.
- Live check, 11 Oct, real Opus 5.5, 393 wide: a new batch on the new brief ("I'll Get My Own", "Tell Her I Said Hi", "Same Time Next Week": three different subjects, adult, everyday, sung to "you"); the next two came instantly (about 1.6 s) because the batch was fetched ahead; a rework of "Same Time Next Week" (title and one line kept, "more grown-up and sexier, less sad") kept both word for word and changed the angle; Make it a page; two taps put two lines in the draft; "chorus lines, flirty and confident" put six lines on the page and none in the draft. Not checked: his own iPhone.

## The approved design (10 Oct, `docs/design/`)
Built to `APPROVED_DESIGN_SPEC.md` and `APP_CHANGES_v2.md`. Checked offline with the labelled stand-in writer only: layout at 320, 393, 430, 768 and 1440 wide and dark mode (no sideways scroll, nothing off the edge), and the behaviour tests below. None of this says anything about writing quality; that depends on the model and prompts, which are unchanged pending Sam's blind votes.
- Write is a springboard: one idea at a time (title strips, short concept, a first thread), his own fragments, Save idea / Start writing, Previous / Recent / Another idea. Ideas come three per paid request; refreshing never spends. He can type his own starting line instead.
- Song workspace: one plain editable lyric sheet; select lines and ask; one suggestion at a time with Previous / Another / Keep; only Keep changes the lyric, and only the selected span; Undo. Starting points sit beside the lyric until "Add to lyrics". Rhyme target (fixed or linked to a line), rhythm and meaning carry forward and are visible.
- References: checked against the research pack first, then a web search, else an honest "couldn't check"; ambiguous names offer a choice; "Not this one" removes it everywhere.
- Journal: All / Ideas / Fragments / Songs, search. Earlier sessions still open from Recent.
- Model choice stays in Settings and is recorded per run; nothing in the interface or saved writing depends on it.
- Live check, 10 Oct, real Opus 5.5, phone-sized window (393 wide, dark): ADÉLA reference from the pack; an idea using it; a fragment saved word for word; Start writing; first thread added; a line selected, 4 options, Next, Keep changed only that line; Another brought 4 more with the first 4 still reachable; a web-search reference (Olivia Dean). Existing data intact: 2 earlier sessions, the song, the saved line, all 22 experiment trials with their votes. Three small faults found and fixed the same night (starting point still said "not yet in your lyrics" after adding; instruction field clipped its second line; Check gave no sign it was working).

## Works (verified before the redesign)
- Write: ideas / lines / drafts / conversation, references, "more like this", session history, recoverable after refresh, unsent text kept locally.
- Journal: seeds, single lines, songs; search; filters; star; edit; delete (songs from a seed survive).
- Song page: sections with stable line IDs, tap-to-select lines and words, locks, direct literal edits, writer-assisted edits with before/after, free-text editing, drafts, full version history with restore, conflict protection.
- Suno: style + exclude + per-section tags around exact lyrics; stale warning when lyrics change.
- Settings: model and thinking level, spend caps and receipts, taste notes and example lyrics, 12-brief test pack with judging, blind Experiments screen (prompt versions and research craft notes; 22 trials judged by Sam on 10 Oct), craft-notes scope (off / edits only / everything, default edits only), JSON + Markdown export, sign out.
- Research pack (10 Oct): `research/pack` — 552 sources, 56 craft cards, 16 reference profiles, 16 original teaching pairs; loaded at boot; keyword retrieval; see `research/SUMMARY.md` and `research/INTEGRATION.md`.
- Tests: 59 automated (5 for 11 Oct); 54 automated (19 for the redesign in `tests/studio.test.ts`); before that 35 (lyric safety, locks, conflicts, duplicates, spend cap, Suno verbatim, no-writer state). Full browser flow at iPhone size, light and dark, plus desktop, using the labelled stand-in writer.

## Live
- https://songroom-qyvq.onrender.com (Render, $7.25/mo). Test pack run on real Opus 5.5 on 9 Oct: 12/12 succeeded, every hard check passed, $0.33 total. Results are in Settings → Test pack for Sam to judge.

## Not yet verified
- Real iPhone Safari (keyboard, selection, home-screen install).

## Deferred
inferred taste rules, generated artwork, voice memos, restore-from-backup UI, print view, GPT-6 Astra adapter.
