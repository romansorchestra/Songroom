# Songroom

Private songwriting app for Sam (single user). Spec: `docs/PRODUCT_SPEC.md` (amendments at the top win). Status: `docs/BUILD_STATUS.md`. Decisions: `docs/DECISIONS.md`. Running it: `docs/OPERATIONS.md`.

## Rules that matter most
- Never change lyric text outside what was selected. Span edits are rebuilt server-side as prefix + proposal + suffix (`server/engine/lyrics.ts`). Locked lines can't change by any route.
- Revisions are immutable. Every accepted change makes a new revision; stale base revisions get 409 unless only untouched lines moved on.
- Suno output wraps Sam's exact lyrics; the model only writes bracketed tags.
- Never present stand-in output as real writing. "Fixed" means seen working on the live build with the real writer.
- Sam's preferences: plain English, no technical detail unless a decision is needed, manual steps batched into one idiot-proof block.

## Layout
- `server/engine/` writer adapter, prompts (versioned; bump `PROMPT_VERSION` on change, keep old variants verbatim), schemas, validators, lyric model, `pack.ts` (research pack loader + retriever), `lessons.ts` (what Sam has told the writer: one standing instruction per note he sends with a rework, read with every request via `svc.tasteFor`, listed in Settings; add rules there, never as new law text in a brief)
- `server/studio.ts` the approved design's operations (springboard, rework, page lines, fragments, workspace suggestions, references, the Browse list of ten, titles for a song's next section); `engine/hook.ts` where the title lands in an idea's lines (assigned per idea, checked, retried with the rhyme check); `server/engine/barometer.ts` picks idea subjects from `research/charts/barometer.json` (what charted on Spotify US, see `research/charts/SUMMARY.md`); `shared/lyricShape.ts` line rules used by server and browser
- `server/learning.ts` what the writer has noticed about what Sam keeps: outcomes per idea (page / save / rework note / picked from a list / passed over) → a `reflect` call every ten ideas → `taste.learned`, read via `svc.tasteFor` after his taste notes and lessons
- `server/hang.ts` the hang (a session's talk read for titles/concepts/lines; `engine/transcribe.ts` is the Deepgram adapter; nothing not in the transcript reaches him)
- `server/service.ts` all domain operations; `server/app.ts` routes; `server/evals.ts` the 12-brief test pack; `server/experiments.ts` blind prompt/research comparison
- `research/` the songwriting-craft research: `PLAN.md` (audit), `SCHEMA.md`, `pack/` (the retrievable collection: cards, profiles, pairs, sources, manifest), `raw/` (agent findings), `SUMMARY.md`, `INTEGRATION.md`. Rebuild the pack with `python3 -I research/build_cards.py` etc. Never quote lyrics into it.
- `web/src/` React app, four destinations (14 Oct 2026 plan): `Ideas.tsx` (one idea at a time; also a saved idea at #/idea/:id), `Create.tsx` (one brief → one result at a time over the thread engine; ?idea= develops an idea via rework with `stay`; ?song= works for a song), `Journal.tsx` (+ New song), `Workspace.tsx` (song page: title, draft first, one Help field, one suggestion, Scraps drawer), `Hang.tsx`, `Direction.tsx` (references), `paper.tsx` (shared pieces), `Settings.tsx`, `Thread.tsx` (earlier sessions), `App.tsx` (shell: bottom tabs on a phone, top nav from 700px; legacy routes). Design source: `docs/design/`. Check layout at 320/393/430/768/1440 and dark; `tests/journeys/simplification_journeys.py` drives the plan's acceptance journeys in a real browser against the stand-in.
- Model choice is a setting only; do not tune prompts to unfinished blind votes.
- Check the live writer with `POST /api/springboard/preview` (saves nothing to his board), never by generating on his Write screen.
- `tests/` vitest: lyric safety + HTTP end-to-end with deliberately badly-behaved writer doubles

## Commands
- `npm test`, `npm run typecheck`, `npm run build`, `npm start`
- Local with placeholder writer: `SONGROOM_STANDIN=1 APP_PASSWORD=dev SESSION_SECRET=dev node dist/server/index.js` (SQLite file in `.data/`)
