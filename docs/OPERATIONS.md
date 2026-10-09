# Operations

## Environment
| Variable | Purpose |
| --- | --- |
| `APP_PASSWORD` | The single login password |
| `ANTHROPIC_API_KEY` | Console API key for the writer (keep it out of shell profiles so Claude Code keeps using the Max subscription) |
| `SESSION_SECRET` | Signs the login cookie (Render generates it) |
| `DATABASE_URL` | Postgres (Render wires it). Absent locally → PGlite in `.data/` |
| `SONGROOM_STANDIN=1` | Local only: placeholder writer for UI checks; never in production |

## Deploy
Render Blueprint from `render.yaml`. Push to `main` redeploys. Migrations run on boot (`server/db.ts`), additive only; never edit an applied migration.

## Backups
Settings → Backup downloads full JSON (every table except secrets) and a readable Markdown journal. Render paid Postgres also keeps daily snapshots. Restore-from-JSON UI is not built yet (deferred).

## Costs and limits
Settings → Spending shows today/month against caps and recent requests. The Anthropic Console is the real bill. Max-plan API credits ($100/mo on Max 5x, $200/mo on Max 20x) can be linked to one Console org from claude.ai → Settings → Billing; they don't roll over.

## Rotating the API key
Create a new key in the Anthropic Console, paste it into Render → songroom → Environment → `ANTHROPIC_API_KEY`, save (Render restarts), then delete the old key.

## Interrupted requests
A restart during a request marks it "interrupted, may have been billed". Nothing retries automatically.
