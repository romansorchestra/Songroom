# Handoff — 16 October 2026

Written so the next chat can carry on building without the old one. Read this, then
`CLAUDE.md` (the rules), then whichever of `docs/PRODUCT_SPEC.md`, `docs/BUILD_STATUS.md`,
`docs/DECISIONS.md` and `docs/OPERATIONS.md` the task needs. This file is a living document:
update it when the state changes.

## For Sam, in thirty seconds

- Everything built so far is live and checked on the real writer. Nothing is half-done.
- Your last question (by voice, 16 Oct) was how to make the app's **brain and taste** better.
  The honest answer is at the bottom of "Sam's open question": the two biggest taste levers in
  the app — your taste notes and a few of your own lyrics, under Settings → Voice — are
  **empty**. The writer has never read a line of yours. Filling that in takes you ten minutes
  and beats anything I can build. The build options come after it, ranked.
- To continue in a new chat, paste the block at the end of this file.

## What this is

Songroom is Sam's private, single-user songwriting app. He is a professional songwriter
(credits with Lewis Capaldi, Ed Sheeran, Alicia Keys, Calvin Harris). The app gives him song
ideas (title, one-breath concept, a few chorus lines), reworks them to his notes, keeps a
Journal of songs with precise lyric edits, reads the pre-session "hang" for titles and lines,
and learns from what he keeps. The writer is Claude Opus 5.5 through his own API key on Render.

- Live: https://songroom-qyvq.onrender.com (he is signed in on his phone and in the desktop
  app's browser pane). Phone first — he uses it in writing sessions.
- Repo: https://github.com/romansorchestra/Songroom — `main` auto-deploys to Render. A deploy
  takes 10–12 minutes and **restarts the app**, which kills any run in flight.
- In a cloud session the clone lives at `/home/claude/songroom` (clone it again if it's gone).
- Stack: Node 22 (`node:sqlite`), Express 5, Zod, React 19 + Vite, esbuild, Anthropic SDK with
  structured outputs. Deepgram for the hang's recordings.

## State on 16 October

Shipped and seen working live, in order (details in `docs/BUILD_STATUS.md`):

1. **Lessons** (11–12 Oct): a note he sends with a rework becomes one standing instruction the
   writer reads every time; scoped *standing* or *this session* (12 h), can supersede an
   earlier one; listed and deletable in Settings. One lesson exists today, about the 'hall'
   rhyme.
2. **Ideas at hit scale** (12–13 Oct): subjects drawn from what actually charted (Spotify US
   Top 50, Oct 2023–Oct 2026, `research/charts/`), concepts of one breath (≤25 words), the
   title placed in the lines on purpose (opens / closes / in passing — `engine/hook.ts`),
   checked and retried with the rhyme checker.
3. **Learning** (13 Oct): every idea's fate is recorded (page / save / rework note / picked
   from a list / left in a list / passed over); every ten ideas a `reflect` call writes what he
   *goes for* and *passes on* into `taste.learned`, read with every request. Live today: three
   "goes for" lines, **zero** "passes on", from 40 outcomes — the pass-over signal is silent
   (see the open question).
4. **Titles for the next section** (13 Oct): paste the lyric so far, get eight titles each with
   the two lines they land in; Use this title. Checked on his real lyric.
5. **The simplification** (14 Oct, his own plan): four destinations as bottom tabs — **Ideas**
   (one idea at a time), **Create** (one brief → one result at a time, develops an idea, works
   for a song), **Journal** (collection + New song; song page = title → draft → one Help field
   → one suggestion → Scraps drawer), **Hang**. Old links still work. Live-checked at phone
   size and desktop on 14 Oct.

Last commits: `c763a4a` (live-check note), `ca4aece` (the four destinations), `057f7ef`
(titles for the next section), `ecb5887` (keep learning).

Loose ends, none urgent:
- The tab bar is meant to step aside while he types on his iPhone; only his phone can confirm
  it does. Ask him.
- Create's results go through the thread engine (`svc.sendMessage` / `writePrompt`), which has
  no rhyme or title check; Ideas has both (`studio.checkOrRetry`).
- One of his Journal songs has a pasted lyric as its title ("It's a chance I'm willing to take
  take a a mistake…"); he can tap the title to fix it.
- Settings → "What it's noticed" has not been looked at on a phone.
- The Anthropic key in Render (named "New no10" in the Console) **expires 3 November 2026**.
  Rotate it per `docs/OPERATIONS.md` before then — he pastes the new key into Render himself.

## The brain, piece by piece

| Piece | Where | What it does | What's in it today (live) |
|---|---|---|---|
| System core | `server/engine/prompts.ts` `PROMPT_VERSION=p2.2` | The writer's standing rules (rhyme words must belong in the scene, etc.) | Fixed text; bump the version to change it, keep old variants verbatim |
| Idea template | `prompts.ts` `IDEA_TEMPLATE=ws5`, `sparkPromptV2` | One-breath concept, title placement, hit-scale examples | — |
| Taste notes + voice | Settings → Voice; `svc.tasteFor` → `tasteBlock` | His own words on his taste + up to four of his lyrics, read with every request | **Empty.** 0 characters of notes, 0 lyrics |
| Lessons | `server/engine/lessons.ts`, Settings → Lessons | One instruction per rework note; standing / session; supersedes | 1 lesson ('hall') |
| Learned | `server/learning.ts`, Settings → What it's noticed | Reflects every 10 ideas on outcomes → goes for / passes on | 3 goes-for, 0 passes-on, basis 40 |
| Subjects | `server/engine/barometer.ts` + `research/charts/` | Picks subjects by genre from what charted; `hitConcepts` = real charted situations given as examples | 1,225 songs classified |
| Craft pack | `research/pack/`, `server/engine/pack.ts` | Retrievable cards/profiles/pairs on songwriting craft; a reference pulls the artist's verified profile | `sam_judgments.jsonl` holds his 22 blind votes |
| Checks | `engine/rhyme.ts`, `engine/hook.ts`, `shared/lyricShape.ts` | By-sound rhyme check, title placement, line shape; a failed check retries the lines once | Engine-side, no model cost |
| Measuring | `server/evals.ts` (12 briefs), `server/experiments.ts` (blind A/B he votes on) | The only honest way to know a taste change helped | Rule: never tune prompts to unfinished blind votes |

## Sam's open question (16 Oct, by voice): "improve its brain and its taste"

What I'd tell him, ranked. Bring him **one question at a time**, and say outright which to do.

**A. Fill the empty levers (him, ten minutes, no build).** Settings → Voice: five to ten
lyrics he's proud of, one line each on what the song was going for, and taste notes in his own
words (what he keeps, what he never wants — "nothing clever, nothing I wouldn't say to her").
Everything the writer makes reads this. Then run the same brief through
`POST /api/springboard/preview` before and after and show him the difference. A build
alternative if he'd rather not paste: let the writer draw voice examples from his own Journal
songs automatically (his words, already in the app) — opt-in, a decision for him.

**B. Tell it why (small build, a day).** Today the pass-over signal is silent: "Another" says
nothing about *why*, so after 40 outcomes the writer has learned nothing it should avoid. Add
one optional tap after Another — *wrong subject · too clever · weak title · don't believe it ·
heard it before · fine, just not today* — recorded on the outcome and read by `reflect`. Add
"Love this" → the idea is kept as an **approved exemplar** and shown to the writer as a
few-shot model in `sparkPromptV2` (the way Harmony keeps approved melodies). This is the
cheapest real taste gain after A.

**C. A critic between the writer and him (medium, two days).** Generate twice as many ideas,
have a second call rank them against his taste notes, lessons, learned lines, approved
exemplars and hit scale, and show only the top half (the rest stay in History). Roughly doubles
the cost per idea (a batch is a few cents today). Make it a setting, and ship it only if it wins
a blind vote in `experiments.ts`.

**D. Titles that people say (small, folds into C).** Hit titles are short, concrete and
conversational; a rubric for the critic (or an engine check) that marks a title down for
abstract nouns, "-ness" words, or anything nobody would say out loud.

**E. Situation first (prompt change, measured).** Attack his "concepts I would never hear in
songs" directly: pick a real charted situation from `research/charts/classified.json` first,
then have the writer find the title and lines *for it*, instead of passing situations as
examples. Blind-vote it against ws5 before it becomes the default.

**F. Lines that sing (engine, no input from him).** A stress/syllable check between paired
chorus lines, next to the rhyme checker, retrying lines that don't scan together.

**G. The reference should teach.** When he names a reference song, the artist's craft profile
from the pack is attached to the reference today (`studio.ts` ~line 724); check how much of it
reaches the brief, and give the writer the artist's title placement, rhyme habits and form.

Order: A tonight (his), then B, then C+D, then E, with blind votes throughout. Say so.

## How to work here

**The rules** are in `CLAUDE.md`; the ones that cost the most when broken:

- "Fixed" means seen working on the **live build with the real writer**, on the phone, in the
  scenario he reported. Never declared from the stand-in or a green suite.
- Never generate on his live Ideas or Create screens to test — use
  `POST /api/springboard/preview` (saves nothing) or a rework with `preview: true`. If a check
  has to save something, delete it after; the harness may block deleting his songs — then tell
  him exactly which to delete.
- Before pushing, check nothing is running: `GET /api/receipts` — no row with
  `status: "running"`. A deploy restarts the app.
- Never change lyric text outside what he selected; revisions are immutable; Suno output wraps
  his exact words.
- Prompts are versioned: bump `PROMPT_VERSION` / `IDEA_TEMPLATE`, keep old variants verbatim.
  A rule goes in the rulebook or the engine, never as new law text pasted into a brief.
- Never quote third-party lyrics anywhere (his thread history contains ADÉLA lyrics; do not
  surface them). His own lyrics, pasted by him, are his to use.
- Never type passwords. API keys only ever go into Render by him, never into chat.
- Pushing to `main` is the only deploy; Render's manual deploy and deleting his songs are
  blocked for Claude. Container egress cannot reach onrender.com; the live site is reached
  only through the browser pane on his linked computer (needs his computer awake).

**Commands** (cloud container):

```
git clone https://github.com/romansorchestra/Songroom.git /home/claude/songroom && cd /home/claude/songroom
```
```
npm ci && npm test && npm run typecheck && npm run build
```
Stand-in app for browser journeys (start and stop it in separate shell calls — `pkill` in the
same call kills the shell):
```
SONGROOM_STANDIN=1 APP_PASSWORD=dev SESSION_SECRET=dev PORT=8742 DB_PATH=/tmp/claude-0/sr/s.db node dist/server/index.js > /tmp/claude-0/sr/server.log 2>&1 &
```
```
pip install playwright --break-system-packages && python3 tests/journeys/simplification_journeys.py
```
(34 checks at 393 wide against the stand-in; not part of `npm test`.)

Live check: open `https://songroom-qyvq.onrender.com` in the browser pane, emulate 393×720 for
phone checks and reset to desktop after; the served bundle is
`document.querySelector('script[src*="index-"]').src` — confirm it changed after a deploy.

**Commit style**: a plain-English subject that says what changed for him; end with
```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: <the session link>
```
and update `docs/BUILD_STATUS.md` (and `DECISIONS.md` for a decision) in the same commit.

## Working with Sam

- Plain English. No technical detail unless a decision is needed. He skims.
- One question at a time; wait for the answer.
- Say outright which option is best; he values that over reassurance.
- Claude does the work and the QA; he only sees verified builds. Full authority; only
  irreversible decisions come to him.
- Anything he must do by hand: one numbered, idiot-proof block, each command or URL in its own
  copyable code box, what he should see, what to paste back. If a sequence is interrupted,
  restate it from where he actually is.
- Report after milestones, short, outcome first.

## Start the next chat with this

```
Continue building Songroom (repo romansorchestra/Songroom). Read docs/HANDOFF.md first and follow it. Then pick up at "Sam's open question": I want to improve the app's brain and its taste. Tell me outright which option to do first, and ask me one question at a time.
```
