# The diary-pop cohort, tested (11 Oct 2026)

Sam's hypothesis, in his words: "most songs out there these days are female relationship
angst and drama, very conversational, a lot of them echo the kind of popular female
Instagram poet style." He asked specifically about well-streamed album tracks that were
not singles, by Gracie Abrams, Olivia Rodrigo and that cohort.

## What was done

1. **Who sings the hits.** The 292 hits from `SUMMARY.md` (a month or more in the Spotify
   US Top 50, Oct 2023 to Oct 2026) were tagged by the lead voice and lane of their
   primary artist (`raw/artist_voice.jsonl`).
2. **The cohort's catalogues.** Every track with lifetime streams for 36 artists, pulled
   from kworb.net's Spotify artist pages (`raw/artist_tracks.json`, 3,418 tracks). For
   every album, deluxe or EP released since Jan 2023, each track was marked single /
   promo / never a single, from Wikipedia (`raw/singles_*.jsonl`, 1,177 rows).
3. **A style rubric** on 438 songs: the 329 cohort tracks with 80M+ streams, plus 109
   hits by other artists for comparison. Subject, who it is sung to, register
   (conversational / imagistic / anthemic / narrative), devices, an "Instagram-poet"
   score 0–3, an angst score 0–3, tone (`STYLE_SCHEMA.md`, `style_classified.json`).
   Written in our own words; no lyrics anywhere. 417 of 438 were known or looked up.
4. **What critics say**, 2023–2026, about the cohort's style and its dominance
   (`raw/critics.md`, about 85 sources).

## 1. Is it "most songs"? No. It is about one hit in six.

| of the 292 hits | share |
|---|---|
| female lead voice | 42% (39% weighted by days in the chart) |
| female voice AND about a relationship | 32% |
| the diary / confessional singer-songwriter lane (Abrams, Rodrigo, Eilish, Swift, Kahan, sombr…) | 16% |
| male lead voice | 56% |
| hip-hop lane | 21% |

- Male voices lead more hits than female ones, and male-sung relationship songs are
  nearly as common (28%) as female-sung ones (32%). The diary lane is 16% of hits by
  count and 15% by time in the chart; it was 19% in 2024, 9% in 2025 and 26% so far in
  2026 (Gracie, Olivia, Taylor and Olivia Dean all released this year).
- Critics' numbers agree: Hit Songs Deconstructed has "introspective" lyrics at 42% of
  2025's Hot 100 top-10 songs, a decade high, but by their own list only about 3 of the
  top 10 and 17 of the year-end 100 are this cohort; Luminate has pop at about 12% of US
  streams against rap/R&B at over 25%.
- What else is big: male earnest ballads (Teddy Swims, Benson Boone, Alex Warren are
  three of the five longest-charting songs of the whole period), country (Shaboozey,
  Wallen, Ella Langley's #1), Latin (Bad Bunny), K-pop (the KPop Demon Hunters songs),
  Gaga/Bruno, Kendrick, and camp/dance pop (Chappell Roan, Charli xcx).

So: the lane is real, prominent and, in 2026, growing, but it is one lane of several.

## 2. Within that lane, is it relationship angst? Mostly relationships; angst only half.

Female cohort, 233 tracks with 80M+ streams (singles and album tracks):

- **83% are about a relationship** or a specific romantic person (other hits: 67%).
  Subjects: after the breakup 22%, trouble while still in it 21%, desire 14%, in love
  14%, inner struggle 8%, wanting someone you can't have 6%.
- **Angst is clear or high in 45%**; the other 55% is tender, horny, joyful, wry or
  defiant. The single most common tone after "sad" (19%) is **wry** (15%).
- **Humour is in a third of these songs** (33%; other hits 17%), and a self-undercutting
  aside in a quarter (24%; other hits 12%). Sabrina Carpenter is 87% humour; Rodrigo
  27%; Chappell 46%; Gracie 20%.

The critics say the same thing from the other side: the praise for Rodrigo, Carpenter,
Hobert and (sometimes) Swift is for wit, sarcasm, blunt self-analysis and comic detail;
the complaint about Gracie Abrams's 2026 album is vagueness and sameness, not angst.

## 3. Conversational? Yes, that part is right.

- **57% of the female cohort's tracks are conversational** in register (sentences you
  could say or text to the person), against 34–40% of other hits, and against 34% for
  the male diary writers (Kahan, Boone, Warren, Swims), who lean anthemic instead.
- **63% are sung straight to "you"** (other hits 61%, so this is pop-wide, not
  lane-specific).
- Named technique, from the writers themselves: Gracie journals and keeps the line that
  made the room laugh; Audrey Hobert outlines lyrics like monologues and vents into
  hooks; Rodrigo writes lyric-first and spends a day on single-line tweaks with Nigro;
  Amy Allen (Sabrina) says the lines that feel "too specific or niche" land hardest;
  bridges are written late and built as the contrast or the shout-along.
- Per artist, conversational share: Sabrina 100%, Gracie 80%, Olivia Dean 75%, Laufey
  73%, Tate McRae 70%, Rodrigo 47%, Chappell 46%, Taylor Swift 26% (she is imagistic
  and narrative), Billie Eilish 18% (imagistic).

## 4. Instagram-poet style? No, and the critics never make that comparison.

- The rubric's Instagram-poet score (short plain declaratives, caption-ready aphorisms,
  second person, healing/self-worth framing) is **2 or 3 for only 8%** of the female
  cohort's tracks (mean 0.5 of 3). Aphorism as a device appears in 8% of album tracks and
  almost no singles. Gracie Abrams and Lizzy McAlpine score highest (about 1.1–1.3), and
  even they are mid-range.
- No critic in about 85 sources compares this cohort to Instagram poetry or Rupi Kaur.
  The only such link is to Taylor Swift in an academic context. The mainstream critical
  complaint about Swift is the opposite of Instapoetry: too many words. Rodrigo and
  Hobert are praised for long, funny, specific lines.
- What they DO share with Instapoetry: the second person, the plain diction, the sense
  of a private note made public, and the therapy-adjacent self-accountability ("I was the
  problem" framing). What they don't share: brevity, aphorism, and earnestness; these
  songs are long on detail and quick to undercut themselves.

A better description of the register than "Instagram poet" is **"a late-night text to
the person, read out loud, with the joke left in."**

## 5. The non-single album tracks: what streamed and how they differ from the singles

155 of the cohort's 329 big tracks were never singles. The largest (lifetime Spotify
streams, millions): Juno 736 (Sabrina), Guilty as Sin? 632 (Swift), You're Gonna Go Far
623 (Kahan), BLUE 597 and THE GREATEST 579 (Eilish), lacy 582 (Rodrigo), Down Bad 560
(Swift), Margaret 535 and Let the Light In 534 (Lana), All My Love 495 (Kahan), Good
Graces 475 (Sabrina), Who's Afraid of Little Old Me? 462, So High School 449, So Long,
London 447 (Swift), all-american bitch 453 and the grudge 420 (Rodrigo), SKINNY 409
(Eilish), making the bed 374, love is embarrassing 372 (Rodrigo), Nobody's Son 357
(Sabrina), Orange Juice 357 (Kahan), Siren sounds 326 (Tate), us. 313 (Gracie).

Female cohort, album tracks (128) versus singles (97):

| | album tracks | singles |
|---|---|---|
| trouble while still in it | 27% | 14% |
| desire | 7% | 25% |
| angst clear or high | 52% | 34% |
| wry / bitter / defiant tone | 45% | 25% |
| humour | 36% | 29% |
| the title repeated as the hook | 16% | 42% |
| Instagram-poet score 2–3 | 13% | 1% |

So the album tracks fans push are the **messier, angrier, funnier, more specific ones**:
the situationship, the ex's new girl, the self-sabotage, the grudge; while singles are
desire and love with a repeated-title hook. The fan-favourite cut is not the sad one, it
is the one with the sharpest situation and the most quotable turn. Critics attribute the
breakouts to bridges built as shout-alongs, deluxe bonus tracks resurfacing on TikTok,
"who is it about" decoding, and meme-able punchlines; release-week superfan streaming
explains the chart sweeps more than the writing does.

## 6. What this means for Songroom

- The subject mix already in the app is right for mainstream pop. For this lane the
  mix is more relationship-heavy (83%) and the register is the point: conversational,
  to "you", with one specific detail and a self-aware or funny line, and a situation
  sharper than a mood. That is now a selectable lane ("Diary pop") in the barometer with
  its own mix; it is not the default.
- Avoid in this lane: aphorisms, healing vocabulary, vagueness, a mood without a
  situation. Critics punish exactly those.
- The album-track pattern is a brief in itself: "the messy one, not the single".

## Caveats

- The rubric was applied by model classifiers (Sonnet on half, Fable on the rest); 21
  songs stayed unknown (mostly 2026 releases and deep cuts). Treat percentages as
  ±5 points.
- "Hits" are by time in the Spotify US Top 50, which under-counts radio-only and
  over-counts release-week album sweeps; the album-track analysis is by lifetime streams.
- Critics' quotes in `raw/critics.md` passed through a summariser; check originals
  before reusing any of them.
