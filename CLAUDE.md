# Songroom

Private songwriting app for Sam (single user). Spec: `docs/PRODUCT_SPEC.md` (amendments at the top win). Status: `docs/BUILD_STATUS.md`. Decisions: `docs/DECISIONS.md`. Running it: `docs/OPERATIONS.md`.

## Rules that matter most
- Never change lyric text outside what was selected. Span edits are rebuilt server-side as prefix + proposal + suffix (`server/engine/lyrics.ts`). Locked lines can't change by any route.
- Revisions are immutable. Every accepted change makes a new revision; stale base revisions get 409 unless only untouched lines moved on.
- Suno output wraps Sam's exact lyrics; the model only writes bracketed tags.
- Never present stand-in output as real writing. "Fixed" means seen working on the live build with the real writer.
- Sam's preferences: plain English, no technical detail unless a decision is needed, manual steps batched into one idiot-proof block.

## Layout
- `server/engine/` writer adapter, prompts (bump `PROMPT_VERSION` on change), schemas, validators, lyric model
- `server/service.ts` all domain operations; `server/app.ts` routes; `server/evals.ts` the 12-brief test pack
- `web/src/` React app (Write, Journal, Song page, Settings)
- `tests/` vitest: lyric safety + HTTP end-to-end with deliberately badly-behaved writer doubles

## Commands
- `npm test`, `npm run typecheck`, `npm run build`, `npm start`
- Local with placeholder writer: `SONGROOM_STANDIN=1 APP_PASSWORD=dev SESSION_SECRET=dev node dist/server/index.js` (PGlite in `.data/`)
