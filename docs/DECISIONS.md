# Decisions

- **2026-10-09 Stack.** TypeScript, Express 5, React 19 + Vite, Postgres on Render (PGlite locally/tests, same SQL), Zod at the API boundary, Anthropic SDK with structured outputs (`output_config.format`) and `output_config.effort`. No Next.js, Supabase, job queue or ORM: one user, one process.
- **2026-10-09 Model.** Default `claude-opus-5-5`. Effort: `high` for ideas/drafts, `medium` for edits and Suno. Both adjustable in Settings. Rates snapshot in `server/engine/writer.ts` dated 2026-10-08.
- **2026-10-09 Literal edits skip the model.** "Change X to Y" with no creative words is applied directly (whole-word, case-sensitive first). Free, exact, recorded as `edit:direct`.
- **2026-10-09 Constraint checks.** Model reports constraints it read; a deterministic regex extracts counts and quoted start/end phrases; code validates. Failing options are shown with a ✗ label, not hidden, and not auto-repaired (no second paid call). Revisit if Sam finds this noisy.
- **2026-10-09 Spend.** Daily $10 / monthly $150 caps by default. Before each call the worst-case cost (max tokens × output rate) is reserved under a lock; actual cost from reported usage replaces it. Failures with unknown usage keep the reservation (counted, not assumed zero).
- **2026-10-09 Hosting.** Render web `0.5c-512mb` ($7) + Postgres `0.1c-256mb` ($6). Free tiers rejected: web sleeps after 15 min (~1 min wake, kills in-flight runs), free Postgres is deleted after 30 days.
- **2026-10-09 Design.** Lyric pages are yellow legal-pad sheets (blue rules aligned to line height, red margin, blue-black ink, Newsreader); chrome is quiet graphite with Instrument Sans. Margin doodles stand in for illustrations.
