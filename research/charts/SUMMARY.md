# What charting songs are about (Spotify US Top 50, Oct 2023 – Oct 2026)

Asked for by Sam on 11 Oct 2026, after using the springboard: the ideas were too high
concept, and one read as a teen novelty. He asked us to look at what actually entered
the Spotify US Top 50 over the last three years and use the subjects as a barometer.

## How it was built

- **Chart:** Spotify's US daily chart, as published on kworb.net, read from 388
  Internet Archive snapshots (1 Oct 2023 to 5 Oct 2026, about one every three days).
  A song counts if it reached position 50 or better in a snapshot. A song already
  charting before October 2023 counts only if it newly entered in the window.
- **Songs:** 1,225 entered the top 50. 292 of them were there in 10 or more snapshots
  (about a month or more). These are the **hits**. The rest are mostly album-release
  deep cuts that charted for a day.
- **Classification:** each song was put in one subject, plus perspective, genre,
  explicitness, title type and concept scale. This came from model knowledge and web
  look-ups, written in our own words, with no lyrics. 883 of the 1,225 are known or
  looked up. Most unknowns are album deep cuts (Drake, Bad Bunny, Playboi Carti and
  similar), so the hits are the reliable layer: 241 of 292 known.
- **Files:** `us_top50_entries.json` (the list), `classified.json` (one row per song),
  `barometer.json` (the per-genre mix the app uses), `SCHEMA.md` (the labels).

## Findings (hits)

| | pop / R&B / dance / K-pop | country | hip-hop | all hits |
|---|---|---|---|---|
| about a romantic or sexual relationship | **75%** | 70% | 26% | 62% |
| biggest subjects | desire 19%, trouble in it 17%, after the breakup 16%, in love 15%, self-worth 11% | after the breakup 27%, trouble in it 18%, inner struggle 15% | money / status 64% | trouble 15%, desire 15%, breakup 14%, flex 14% |
| sung straight to "you" | **60%** | 36% | 17% | 44% |
| everyday situation told plainly | 50% | 67% | 87% | 63% |
| everyday situation with one clever angle | 42% | 33% | 13% | 33% |
| built on an unusual premise or conceit | **9%** | 0% | 0% | 4% |
| title is a plain phrase people say | 60% | 58% | 53% | 56% |
| suggestive / explicit | 42% / 4% | 27% / 0% | 9% / 87% | 31% / 21% |

What this means for ideas:

- **Pop hits are about one person.** Three in four are about a relationship: wanting
  someone, it being complicated, it ending, or being in love. Most are sung to that
  person.
- **High concept is rare.** Fewer than one pop hit in ten is built on a conceit. Half
  are a plain everyday situation; the other half add one clever angle.
- **Adult and often suggestive.** Desire is the biggest single pop subject. It is
  suggestive far more often than explicit.
- **Titles are things people say.**

## How the app uses it

`server/engine/barometer.ts` picks a subject for each idea in a batch, weighted by the
mix for his chosen genre: pop by default, or set with a chip on the Write screen. The
three ideas in a batch never share a subject, and subjects he has just seen are less
likely. The idea brief (`sparkPromptV2`, template `ws2`) carries the figures above.
His direction always overrides the assigned subject.

## Follow-up (11 Oct, later)

Sam asked about the diary-pop cohort (Gracie Abrams, Olivia Rodrigo and company), their
well-streamed album tracks, and whether "female relationship angst, conversational,
Instagram-poet style" is what most songs are now. `COHORT.md` tests that: the lane is
16% of hits, not most; 83% of it is about a relationship; it is conversational (57%) but
not Instagram-poet (8%); and the album tracks fans push are the messier, funnier, more
specific ones. The app has a "Diary pop" lane built from it.

## Limits

- Snapshots are about three days apart, so a song that was in the top 50 for a day or
  two between snapshots can be missed. The hits layer is unaffected.
- Subjects of unknown deep cuts are guesses. The figures above use the hits only.
- These are subjects, not quality. The mix says what charting songs are about, not how
  to write them well.
