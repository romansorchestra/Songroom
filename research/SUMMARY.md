# Songroom research — summary (pilot, 10 Oct 2026)

Short version. The structured collection in `research/pack/` holds the detail; `INTEGRATION.md` says how the app uses it; `PLAN.md` has the audit.

## What was done

- **Audit** of the live generator (prompt p1.1): three standing instructions forced every idea into a realisation story with a title twist and a domestic detail. Fixed as prompt p2.0 (its own experimental condition, so the benefit of the prompt fix is separated from the benefit of research).
- **Pilot research**, eight parallel passes, research cutoff 10 Oct 2026, discovery window Oct 2024–Oct 2026 plus enduring examples and Sam's named references. Slices: Amy Allen; ADÉLA/PRIMA; pop A (Carpenter, Roan, Eilish/Finneas); pop B (Abrams/Hobert, Lola Young, Charli XCX, Addison Rae, Tate McRae, Alex Warren, Teddy Swims); Rodrigo/Nigro; the Nashville room (Wallen catalogue and its writers) as a comparison group; Sheeran, Tyler, narrative singer-songwriters (Kahan, Hozier, Capaldi, Boone); cross-genre craft (Pattison, Kotecha, Martin's team, Tranter, Michaels, Warren, Tedder, McKee, McKenna, Wilson, Finneas, Antonoff).
- **Actual counts.** 552 source records: 406 fetched in full, 43 in part, 7 snippet-only, 88 blocked, 8 not found (blocked and incomplete entries are kept, labelled, and not used as evidence). 127 raw findings: 104 documented statements, 17 observable features (from fetched press; no audio), 6 analytical inferences. 107 song records carry verified credited-writer lists. 56 craft cards (47 built on documented statements, 5 on observable features, 4 labelled as our inference). 16 reference profiles. 16 original teaching pairs. Zero lyric lines reproduced anywhere; interview quotes at most one per source, under 12 words, five spot-checked against the live page by the lead and all verified.
- **In the app**: pack loader and keyword retriever (`server/engine/pack.ts`), prompt p2.0, a `craftPack` setting (default off), a blind three-way experiment screen, 35 automated tests. Deployed; the first live batch (11 fresh briefs × 2 repeats × 3 conditions) started 10 Oct 2026 15:34 PT on real Opus 5.5.

## What we learned that is more specific than generic advice

**Language.**
- Several writers independently describe the same move: write down the artist's exact spoken words and build the lines around them (Tranter, Antonoff on Carpenter, McAnally). Carpenter says she treats singing as acting and pictures the person as she sings; that is why "would this narrator say it" is the test, not "is it true".
- The line the room flags as too weird/too far is "usually the best part of the song" (Allen, about nine in ten); Steph Jones kept the "silly" Espresso line for the same reason. Counter-evidence is also documented: by Man's Best Friend critics found the puns and profanity overused. So: keep the flinch line, re-listen cold, ration.
- Humour's placement is specific, not general: sincere line first, undercut second (Antonoff). Abrams and Hobert use laughter as the filter for petty lines and then file the nastiest draft down to sarcasm.
- Charli XCX dropped rhyme for an interior monologue because rhyme "requires a bit of premeditation" and makes a thought sound revisited. That is a precise reason to leave a confession unrhymed, with a precise limit (one song, not a rule).
- Plain vs generic is a real fork, not a quality scale: Ordinary was called "bloodless and generic" by Paste and used at weddings and memorials; Ain't In LA split 17 critics over the same vagueness that made it an anthem. Decide on purpose which product you are writing.

**Musical fit (all text-only, provisional).**
- Pattison's stress rule and his "bridegroom" mis-set example give the app a checkable test: natural speech stress against strong beats, content words stressed, function words not.
- Kotecha: a repeated melodic phrase must match syllable-for-syllable; a flat chorus can be fixed by moving where the pre-chorus starts. Nigro: when a stanza has too many or too few words he fixes it for melodic symmetry while Rodrigo guards every word.
- Placeholders are a template, not a nuisance: Sheeran's "phonetics", McAnally's vowel-sound demos, Abrams' "mouthfeel". The words inherit the groove the syllables proved.
- Gap: no fetched source gives rules for which vowels suit held notes, consonant clusters or elision. The app must not assert them.

**Emotional stance.**
- The narrator who implicates herself first (Manchild's eye roll, Wildflower granting the partner's love, Messy's self-aimed accusations, Lorde's reply accepting blame) is a repeated pattern; Good Luck, Babe! points outward and works, so it is one route, not a rule.
- A happy love song that sounds boastful is a documented failure Rodrigo solved by writing the doubt as a question the song doesn't answer.
- Give the other person a verse (Hey Jane, Girl so confusing, you look like you love me) and let their reply land harder; Slant's critique shows two voices alone don't guarantee stakes.

**Hooks and concepts.**
- Topic vs angle vs twist: Girl Crush's phrase was fixed and its angle chosen in the writing; Tedder's hook definition is an ordinary feeling with new wording. Allen is "bad at writing from a title someone hands her" and finds the song by talking with the artist.
- Titles from room talk with the tense shifted into an admission (I Had Some Help); the address word setting the tone (Jane → Babe); the oddest concrete noun promoted to the title (Backseat → Diet Pepsi); proper-noun titles that stand for a feeling (ADÉLA), with the critics' gimmick warning attached.

**Whole-song function.**
- Chorus universal, verses specific (Tranter, Warren) with Switched On Pop's caveat that the chorus payoff depends on verse setup.
- Pre-chorus as cliffhanger; a weak chorus may be a pre-chorus problem (Warren, Yacoub); a chorus can be fixed by register and key rather than words (Nigro on Roan; Yaron on Ordinary).
- Bridges earn their place by changing stance (Abrams' admission; Roan's two-minute bridge after a year of work); a rejected verse can be the bridge (Nigro); a thrown-out chorus can leave one image for the outro (Rodrigo). Tyler banned intros, outros and bridges for a whole album and said why.
- Withheld arrival as payoff (the cure's drums; drivers license as a build to the bridge).

## General craft vs genre convention vs Sam's taste

- **Looks general** (documented by writers across genres): speech-capture; the flinch line; stress against melody; syllable matching on repeated phrases; chorus/verse split; the pre-chorus cliffhanger; idiom flips; the detail that makes a title true for the singer; sing-testing a title; culling the B song.
- **Genre convention** (country): drinking/truck/small-town vocabulary, the blame-trading heartbreak persona, spoken "talking country" verses, beat-first quick writes to a fixed artist, long credit lists. McAnally and Gorley criticise the formula from inside it. The analyst's sort (CW-F15, card C55) is labelled as such and its transfer outside country is untested.
- **Contemporary pop specific**: humour-before-hurt, self-implication, proper-noun and brand titles, spoken interjections and whispered choruses, the no-rhyme interior monologue.
- **Sam's taste**: none recorded in this collection. Every `sam_judgment` field is null. The pairs carry provisional analyst views only. His votes in Experiments are the first Sam-labelled data and are stored separately from machine labels.

## Writers' statements vs our interpretation

Every card and finding carries a label. 104 of 127 findings and 47 of 56 cards rest on an attributable statement in a fetched source with a locator. The four inference cards are C06 (self-implication pattern), C25 (blame shift in Wallen's catalogue, critics' reading), C55 (the general-vs-genre sort), C61 (connective lines, assembled from chorus/verse statements). Observable-feature cards (C24, C31, C34, C48, C51) describe what fetched press says a record does; we heard nothing.

## What changed in actual suggestions, and did Sam prefer it

Unjudged at the time of writing. The experiment harness stores each trial blind; the tally appears in Settings → Experiments once Sam votes. No claim of improvement is made here. The honest expectation from the audit: p2.0 should remove the forced-narrative failure on pop briefs regardless of research; whether the craft notes add anything beyond that is exactly what the C-vs-B comparison tests.

## Coverage gaps and disagreements

- Blocked at the source: The Guardian, Pitchfork, most Rolling Stone US and Billboard US originals, Vulture, NYT, LA Times, all lyric sites, YouTube/TikTok, most podcast audio (Tape Notes, And The Writer Is, Songcraft). Several key quotes therefore come via reprints or secondary relays and are marked medium confidence.
- Thin: Tyler (no long-form craft interview exists); Taste/Tears/Manchild writing process; Headphones On and Revolving door words; Hozier on Too Sweet; Capaldi on Survive; Boone's bridge; ADÉLA's producers; ADÉLA on writing in a second language; any documented rejected lines beyond "the Greedy chorus and concept changed" and "the early Good Luck, Babe! verses were more barbed".
- Credits not fully verified: seven PRIMA tracks rest on an uncited Wikipedia table; Love Somebody's writer list differs between the label (6) and Wikipedia (11); Greedy's credits come via Genius only.
- Disagreements worth keeping: melody-first (Martin, Wilson, Sheeran) vs lyric-first (McKenna, Rodrigo); rules-as-generator (Kotecha) vs rules-as-diagnosis (Yacoub, Tedder, Martin) vs no-rules (Michaels); Rolling Stone wants ADÉLA deadpan, NME wants her winking; critics vs audiences on Ordinary and Ain't In LA.
- Not found: any source calling slant rhyme "the modern default" (the p1.1 prompt asserted it; p2.0 doesn't).

## What should stay uncertain, be removed, or be researched next

- Stay uncertain: everything rhythmic and phonetic; the transfer of Nashville-documented techniques to pop; the double meanings in Last Night and get him back! (critics' readings, no writer statement).
- Remove if Sam's votes show it making writing "studied": the pair injection for line work (it is the most instruction-like element), and any card that recurs on every ideas brief without changing output.
- Research next, in order of likely value: (1) the Hollywood Reporter Amy Allen/Manchild interview and the Variety "written in one day" piece, if Sam can supply the text; (2) the Sheeran v Chokri judgment for the fullest sworn account of a loop-first session; (3) Gorley's Songcraft episode on Last Night (transcript needed); (4) Pattison's rhyme and hook-placement essays by exact URL; (5) UK press on Lola Young's 2025 album; (6) anything in the 2026 window the search budget missed (Paper, Nylon, i-D, Dazed on ADÉLA; Grammys 2026 craft coverage). None of this should run as an unattended loop; each is a one-afternoon fetch-and-verify job.
