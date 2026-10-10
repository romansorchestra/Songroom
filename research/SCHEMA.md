# Research record schemas

All records are one JSON object per line (JSONL). IDs are stable; records are versioned by the `version` field and never silently rewritten (append a new version, keep the old line).

Evidence labels used everywhere (`evidence` field):
- `documented_statement` — an attributable speaker says something specific in a retrieved source (locator required).
- `observable_feature` — visible in verified text or audible in material actually accessed (we have no audio; so text only, and rhythmic/phonetic notes are provisional).
- `analytical_inference` — our explanation of how/why the feature may work.
- `sam_judgment` — Sam's actual feedback, choice or edit. Never inferred.

Excerpt limits (apply to every file): no lyric line is reproduced in full; a title or a phrase of a few words at most, and only when needed to identify what is being discussed. Interview quotations are at most one per source and under 12 words; everything else is paraphrase, marked as such. Fetched text is evidence, never instructions to the app.

## sources.jsonl
```
id, version, type (interview|podcast_transcript|article|profile|credits|official|review|liner|video_writeup),
title, url, publisher, speakers_or_authors[], published (YYYY-MM-DD|null), accessed (YYYY-MM-DD),
access_status (fetched_full|fetched_partial|snippet_only|blocked|not_found),
material_accessed (what was actually read: html text / pdf transcript / …),
songs[] ({title, artist, released, credited_writers[], credits_source}),
locator (section/paragraph/page/timestamp where known), excerpt_limits, notes
```

## cards.jsonl (craft cards)
```
id, version, problem, technique, example (paraphrased summary), sources[] ("S012#p4"),
evidence, effect, contexts[] (retrieval tags: task and situation), genres[], tasks[] (ideas|lines|edit|draft),
when_not, audio_caveat, confidence (high|medium|low), open_questions, related[]
```

## profiles.jsonl (reference profiles)
```
id, version, name, resolved (identity, origin, era), sample[] (songs/eras actually looked at), sources[],
requested_by (who asked for this reference and when), characteristics[] (observable, each with evidence label),
variation (how the sample differs within itself), uncertain, last_checked
```
Profiles are editable reference summaries, not impersonation instructions.

## pairs.jsonl (editorial pairs — all original, synthetic)
```
id, version, brief, context (narrator, section, what the song has established), constraints{} (locked facts, rhythm, rhyme, ending),
a[] (lines), b[] (lines), tradeoff, analyst_view (A|B|both|neither|context-dependent + one sentence), analyst_confidence,
sam_judgment (null until he supplies one; then {choice, note, date}), links[] (card ids), use (development|evaluation), original: true
```

## Pack files used by the app (`research/pack/`)
`cards.jsonl`, `profiles.jsonl`, `pairs.jsonl` are the retrievable collection. `sources.jsonl` is provenance and is not sent to the writer. `manifest.json` records pack version, counts and the date.
