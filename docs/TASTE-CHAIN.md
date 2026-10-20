# What the taste test actually changed (19 Oct 2026)

Asked for by the 19 Oct commission, Phase D: for each of the 16 answers, the chain from answer to stored record to interpretation to his decision to any effect on the writing. Read from the live app (backup export and run `r_GaFSMf4O`), read-only.

**Short version.** The 16 card answers are stored and change nothing by themselves. The writer's reading of them produced five findings. On 19 Oct none was kept or turned down; on 20 Oct, from Settings, he **kept four and turned one down** (finding 3, the "I'd rather X than Y" one). The four kept are standing lessons the writer reads with every request from 20 Oct, 16:22 PT. The one thing from that session that does reach the writer is the two songs he marked **Mine**: they became voice examples, and every writing call since 19 Oct, 19:53 PT includes them ("Examples of lyrics Sam has written or kept").

## The chain

Session of 19 Oct, 19:53 PT. Twelve pair answers (two of them repeats), four chorus cards.

| # | Card | What it varied | His answer | Time | Reading that used it | Status | Effect on writing |
|---|---|---|---|---|---|---|---|
| 1 | i08 idea | relatable vs unusual setting | relatable | 20 s | 5 | kept 20 Oct | yes, via finding 5 |
| 2 | c04 chorus | plainspoken vs poetic | **poetic** | 12 s | — (not mentioned) | — | none |
| 3 | f08 chorus | weakness guessed at line 2's ending | tapped "than" in line 2: "just not for me"; then "fair" to the guess | 22 s | 3 | **turned down** 20 Oct | none |
| 4 | t05 title | question vs statement | question | 5 s | — | — | none |
| 5 | i01 idea | everyday vs high concept | everyday | 8 s | — | — | none |
| 6 | t03 title | double meaning vs plain | double meaning | 8 s | 4 | kept 20 Oct | yes, via finding 4 |
| 7 | f03 chorus | weakness guessed at "destiny" | tapped "park": "wouldn't say it"; "fair" to the guess | 11 s | 2 | kept 20 Oct | yes, via finding 2 |
| 8 | c03 chorus | title first vs title last | title last | 20 s | — | — | none |
| 9 | t06 title | "you"-led vs "I"-led | "I"-led | 9 s | — | — | none |
| 10 | f10 chorus | weakness guessed at line 2 (telling what line 1 showed) | tapped "think" in that line (matches the guess) | 8 s | — (counted in the score as matching the guess) | — | none |
| 11 | c05 chorus | specific odd detail vs general picture | general | 23 s | 5 | kept 20 Oct | yes, via finding 5 |
| 12 | i05 idea | familiar vs fresh angle | neither | 23 s | — | — | none |
| 13 | k04 chorus | nothing planted | tapped "light": "forced rhyme" | 15 s | 1 | kept 20 Oct | yes, via finding 1 |
| 14 | t09 title | stock idiom vs fresh image | fresh image | 4 s | 4 | kept 20 Oct | yes, via finding 4 |
| 15 | i01 again | (repeat of 5) | **neither** (changed) | 8 s | — | — | none |
| 16 | t05 again | (repeat of 4) | question (same) | 8 s | — | — | none |

"Is this you?": he marked two Journal songs as his (one titled "Better For Her", one untitled). Both became voice examples at 19:53 PT. **Effect: yes**, in every prompt since.

## The five findings, and how far each rests on its evidence

| | The writer heard | Basis | Analyst's note (not a verdict) |
|---|---|---|---|
| 1 | A rhyme word that is only there to land the rhyme spoils the line | his own find on the clean card (k04, "forced rhyme") | One tap, but it agrees with the one standing lesson he typed himself (rhyme words must belong in the scene). |
| 2 | Words you wouldn't say out loud put you off | f03: "park", "wouldn't say it" | One tap on one word. It may be regional ("car park") rather than general. |
| 3 | The "I'd rather X than Y" construction isn't for you | f08: "than", "just not for me" | One tap generalised to a construction. Over-reaches. |
| 4 | Titles with a second meaning or a fresh image over stock ones | t03, t09 (2 of 2) | Fair reading of two quick picks. |
| 5 | Relatable situations and general pictures over odd specific details | i08, c05 (2 of 2, both slow) | A single chorus vote is not a view on verses; c04 (he chose the poetic chorus over the plainspoken one) isn't reflected anywhere. The writer itself noted the tension. |

None of these is a rule. If he keeps one, it becomes a standing instruction (`lessons`, source `taste`) and the writer reads it with every request; if he says "Not me", it is recorded as turned down with the time; otherwise it stays waiting.

## What changed in the app on 19 Oct so this stays honest

- "Not me" is now recorded (it used to be dropped), with a timestamp; a later decision replaces an earlier one.
- Findings he hasn't decided on wait in Settings → "What you've told the writer", and reach the writer only if kept.
- The chorus cards' weak spots are worded as guesses: "My guess at the weak spot… It's a guess about the example, not a right answer."
- Five quick pairs (`#/taste/contrasts`), optional: repaired teaching pairs whose two sides meet the same brief; A, B, both, neither, or "good, but wrong for this song", with an optional reason. Answers are stored per pair and never switch a card off.
- His accepted edits are read back from the song's revisions (`GET /songs/:id/edits`), with who wrote the new words: his own typing is "sam"; a writer's option he kept is "writer-kept" (preference, not authorship); a save a fraction of a second after a song was made is "unclear". They reach the writer only when `songHistory` is on (off by default, to be tested separately), and only for the same song.

## "Better For Her"

The commission mentions a "Better For Her" session outside Songroom (the chorus payoff kept, "Thought I was making you better for me" preferred, a very specific party setup rejected). That session's text was not supplied. What Songroom holds is the song in his Journal: pasted in on 14 Oct, then three rounds of his own typed changes over fourteen minutes. The chorus payoff never changes. His typed changes are in the pre-choruses, the second verse and the bridge; read with `GET /songs/g_OKuNBp5x/edits`. They are his calls for that song, not rules for others.
