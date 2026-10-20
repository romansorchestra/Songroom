# Traces: research reaching the writer, route by route (19 Oct 2026)

Real runs on the live build (`ce05e6d`), real writer (`claude-opus-5-5`, effort high), read back from the app's own run records. Each row proves the selected records were in the prompt the writer received; none of this says the writing got better. Fixture traces for the same routes, with the production route functions and the stand-in writer, are in `tests/research.test.ts` and `tests/trials.test.ts` (which also checks the test's frozen prompt equals what production sends with research off).

## Production path

| Route | Run | prompt_version | Cards (score: matched tags / words) | Block hash | API generation id |
|---|---|---|---|---|---|
| Ideas, live check (`/springboard/preview`, research = notes only) | `r_6Y0H6rUi` | `p2.2+cards/ws5` | C26 (15.4: attitude, swagger, persona, hook), C14 (9.2: humour, attitude) | `aa6224b96b22` | `req_011CgCvKZJ…` |

Brief: "breakup song with attitude and a sarcastic hook, not a story" (Claude's check, saves nothing). Cost $0.12.

## The research test (`tb_XwF3_TE7`): one trace per route

Each trial's two runs share one frozen system prompt (7,581 characters: his lessons and voice examples) and one frozen user prompt; the "on" prompt is the "off" prompt plus the recorded block, and nothing else (`on − block = off` checked for all eight). The run's `request.pack` carries the route, mode, card ids, reasons, rendered block and hash.

| Route | Case | Run (on / off) | Cards (score: tags / words) | Hash | Generation id (on) | Seconds on / off | Cost on / off |
|---|---|---|---|---|---|---|---|
| Ideas | E2 | `r_E8sFo3gn` / `r_Arh2mu5W` | C22 (10.2: happy love, love), C12 (8.2: devotion, love) | `570898857549` | `req_011CgCvJbX…` | 60 / 66 | $0.12 / $0.14 |
| Ideas | E3 | `r_vMDmbKmO` / `r_ZOJpgDkd` | C22 (14.2: happy love, love, country), C12 (8.2) | `570898857549` | `req_011CgCvRTu…` | 66 / 34 | $0.12 / $0.06 |
| Ideas | E1 | `r_BozKMb5-` / `r_6VhSNID1` | C30 (3: word "good"), C40 (3: word "good") | `2c4f0e18c272` | `req_011CgCvdzj…` | 33 / 51 | $0.06 / $0.09 |
| Develop an idea | E4 | `r_Zmu_34IR` / `r_1SkvpZ9J` | C30 (3.1: title), C36 (3.1: title) | `a471092046d6` | `req_011CgCvZmf…` | 12 / 18 | $0.04 / $0.04 |
| Create | E5 | `r_WuopxlmP` / `r_jkLDZSbm` | C19 (8.2: verse, rhyme), C41 (8.2: place, verse) | `11254c0b86d7` | `req_011CgCvWNR…` | 46 / 23 | $0.09 / $0.06 |
| Journal rewrite | E6 | `r_bkY87QlV` / `r_sO60jEVD` | C17 (16.4: melody fit, syllables, stress, rhythm, pop), C15 (14.4) | `bf965c0fe7e3` | `req_011CgCvPTP…` | 22 / 27 | $0.06 / $0.07 |
| Journal continue | E7 | `r_AmZ9Y4on` / `r_4O9AcJD_` | C44 (8.2: pre-chorus, chorus), C25 (7.1: country) | `d85d9e0d8f25` | `req_011CgCvhov…` | 25 / 26 | $0.05 / $0.06 |
| Find the title | E8 | `r_g9fMbUuf` / `r_UTaVElPD` | C30 (4.1: title), C33 (4.1: title) | `91ac5b63e67d` | `req_011CgCvb6o…` | 39 / 23 | $0.09 / $0.06 |

Sixteen outputs, all succeeded, no failed engine checks on either side. Total $1.21.

Note: this first batch recorded the "on" prompt version as `p2.2/ws5+cards`; later batches use the production shape `p2.2+cards/ws5`.

## What the traces show about retrieval (before any judgment)

- Strong, specific matches where the brief names a craft problem: E6 (rhythm), E7 (pre-chorus), the preview (attitude, hook).
- Weak matches on format words: E1 matched only on "good"; E4 and E8 only on the title tag (score 3–4, just over the threshold).
- Misreadings: E3 ("on the verge of falling in love… won't work out") was scored as a happy love song; E5's C41 ("a song that defines itself against a place") fired on "in place of dots".
- These were not tuned away before the test, by design. If Sam's votes on E1, E3, E4, E5 and E8 don't favour research, the first fix is retrieval (a higher threshold for format-only matches, negation of "falling in love… won't work"), not more research.

## The Hang

Never receives notes, on any setting: checked in `tests/research.test.ts` with every route switched to notes only.
