# Research test, 19 Oct 2026: research off vs on, eight of Sam's own briefs

The first test the 19 Oct commission asked for (Phase E). Live batch **`tb_XwF3_TE7`** in the app's `trials` table, created on the evening of 19 Oct 2026 (PT) on the live build (`ce05e6d`); generation cost $1.21. Sam judges it at `#/trials/tb_XwF3_TE7` (Settings → Experiments → Research test).

## What is compared

- **Off:** the production prompt for that action exactly as it ran on 19 Oct, with no research.
- **On:** the same prompt plus at most two craft cards chosen for that action by `selectForRoute` from pack **pilot-1.2** (no teaching pairs, no pack profiles).

Everything else is identical and frozen when the batch was made: the system prompt (his taste notes, lessons and voice examples as of that moment), the references, the engine-chosen subjects and title placements, the sampled hit-concept examples, model `claude-opus-5-5`, effort (high), the number of candidates, and the post-processing (the ideas rhyme/title check and retry; kept lines put back; selection-scoped replacements). `tests/trials.test.ts` checks that the frozen "off" prompt equals what production sends with research off, route by route.

## The eight briefs (all his, from his own sessions)

| Case | Action | Where it came from | Cards chosen for "on" (score; why) |
|---|---|---|---|
| E1 | Ideas (3 ideas) | his Ideas direction "Flex feel good seductive", pop | C30, C40 (3; only the word "good" overlapped) |
| E2 | Ideas | his direction "A male love song that doesn't make him look feminine or desperate in any way.", pop, ref Noah Kahan | C22, C12 (10.2, 8.2; love / happy love / devotion tags) |
| E3 | Ideas | his direction "Title is Heartbreak King…", country, ref Noah Kahan (with his note on what he likes) | C22, C12 (14.2, 8.2; "falling in love" read as a happy love song) |
| E4 | Develop an idea | his rework of "Same Time Next Week" on 11 Oct: kept the title and one line; "love the title, make it more grown-up and sexier, less sad" | C30, C36 (3.1; title tag only) |
| E5 | Create | his 16 Oct brief "A song called He and I…" with his verse lines, ref Tones and I | C19, C41 (8.2; "rhyme", "verse"; C41 fired on "in place of dots") |
| E6 | Journal rewrite | his 11 Oct Tamagotchi selection, "keep the rhythm, more bratty", ref ADÉLA | C17, C15 (16.4, 14.4; rhythm / stress / melody fit) |
| E7 | Journal continue | his 11 Oct Jumper Cables ask, "A pre chorus that turns it" | C44, C25 (8.2, 7.1; pre-chorus, country) |
| E8 | Find the title | his 13 Oct song "It's a chance I'm willing to take…", "looking for the title for the next section" | C30, C33 (4.1; title tag) |

The card choices were computed before generation and are recorded per trial (`frozen.research`: ids, scores, matched tags and words, the rendered block and its hash). They were **not tuned** on these briefs, so the weak matches above (E1, E4, E8 on a single format tag or word; C41 on "in place of") are what the retriever really does and are part of what this test shows.

## Fixed at creation

- A/B sides: research on is A in two of the four Ideas-side cases and two of the four lyric-side cases, chosen by a seeded shuffle; the mapping is stored per trial (`a_cond`) and never changes.
- Order: shuffled once and stored (`ord`).
- Which side had research is hidden from the judging screen until every trial has a verdict.

## Answers he can give

A, B, both good, neither, skip (separately), "I'd use something here" on either side, an optional reason. Every verdict is kept with its time; a changed answer is added, not overwritten.

## Results

Unjudged as of 19 Oct. When he has judged: raw counts (on / off / both / neither / skip), sparks, A-vs-B position counts, failed checks, seconds and cost per output come from `GET /api/trials/tb_XwF3_TE7/tally`. Eight picks are a lean, not a finding; a repeat of a subset (same frozen prompts, sides flipped: `POST /api/trials` with `repeatOf`) follows the first judgments.
