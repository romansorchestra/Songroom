# Songroom

Private songwriting app for Sam (single user). Spec: `docs/PRODUCT_SPEC.md` (amendments at the top win). Status: `docs/BUILD_STATUS.md`. Decisions: `docs/DECISIONS.md`. Running it: `docs/OPERATIONS.md`.

## Rules that matter most
- Never change lyric text outside what was selected. Span edits are rebuilt server-side as prefix + proposal + suffix (`server/engine/lyrics.ts`). Locked lines can't change by any route.
- Revisions are immutable. Every accepted change makes a new revision; stale base revisions get 409 unless only untouched lines moved on.
- Suno output wraps Sam's exact lyrics; the model only writes bracketed tags.
- Never present stand-in output as real writing. "Fixed" means seen working on the live build with the real writer.
- Sam's preferences: plain English, no technical detail unless a decision is needed, manual steps batched into one idiot-proof block.

## Layout
- `server/engine/` writer adapter, prompts (versioned; bump `PROMPT_VERSION` on change, keep old variants verbatim), schemas, validators, lyric model, `pack.ts` (research pack loader + retriever)
- `server/studio.ts` the approved design's operations (springboard, rework, page lines, fragments, workspace suggestions, references); `server/engine/barometer.ts` picks idea subjects from `research/charts/barometer.json` (what charted on Spotify US, see `research/charts/SUMMARY.md`); `shared/lyricShape.ts` line rules used by server and browser
- `server/service.ts` all domain operations; `server/app.ts` routes; `server/evals.ts` the 12-brief test pack; `server/experiments.ts` blind prompt/research comparison
- `research/` the songwriting-craft research: `PLAN.md` (audit), `SCHEMA.md`, `pack/` (the retrievable collection: cards, profiles, pairs, sources, manifest), `raw/` (agent findings), `SUMMARY.md`, `INTEGRATION.md`. Rebuild the pack with `python3 -I research/build_cards.py` etc. Never quote lyrics into it.
- `web/src/` React app: `Springboard.tsx` (Write), `Workspace.tsx` (song), `Journal.tsx`, `Direction.tsx` (references), `paper.tsx` (shared pieces), `Settings.tsx`, `Thread.tsx` (earlier sessions). Design source: `docs/design/`. Check layout at 320/393/430/768/1440 and dark.
- Model choice is a setting only; do not tune prompts to unfinished blind votes.
- `tests/` vitest: lyric safety + HTTP end-to-end with deliberately badly-behaved writer doubles

## Commands
- `npm test`, `npm run typecheck`, `npm run build`, `npm start`
- Local with placeholder writer: `SONGROOM_STANDIN=1 APP_PASSWORD=dev SESSION_SECRET=dev node dist/server/index.js` (SQLite file in `.data/`)
