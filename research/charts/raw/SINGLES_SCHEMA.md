# Album-track audit (one JSON object per line)

For each artist in your input file, find every album, deluxe/expanded edition, EP or mixtape they RELEASED between 1 Jan 2023 and today (Oct 2026) — use the artist's Wikipedia discography page and each album's Wikipedia page (WebFetch). For EVERY track on those releases, write one line:

- artist, album, released (YYYY-MM-DD), track (exact title as on the album)
- edition: "standard" | "deluxe_only" (only on a deluxe/expanded/anniversary edition)
- single: "single" (released as an official single, before or after the album) | "promo" (promotional single / "instant grat" track) | "no" (never a single)
- single_when: "before_album" | "after_album" | null
- streams: the lifetime Spotify streams from your input file for the matching title (match case-insensitively; ignore "- Live", "- Acoustic", remix, "(feat. …)" differences when the base title matches; if no match write null)
- chart: a short note if Wikipedia says it charted on the Billboard Hot 100 (peak position), else null
- notes: anything relevant in ≤12 words (e.g. "TikTok bridge trend", "Grammy nominated", "fan favourite per reviews") — NO lyrics.

Rules: never write or paraphrase lyric lines. If Wikipedia doesn't list singles clearly, use the album's infobox "Singles" chronology and the track's own article. Every track, valid JSON per line.
