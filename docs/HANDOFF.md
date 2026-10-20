# Handoff — 20 October 2026

Written so the next chat can carry on building without the old one. Read this, then
`CLAUDE.md` (the rules), then whichever of `docs/PRODUCT_SPEC.md`, `docs/BUILD_STATUS.md`,
`docs/DECISIONS.md` and `docs/OPERATIONS.md` the task needs. This file is a living document:
update it when the state changes.

## For Sam, in thirty seconds

- You judged the research test on 20 Oct: **without research won 6 of 8**. Research won only
  Create and Develop. Nothing has been switched on. A short repeat of four of them (same
  briefs, sides swapped) is ready at Settings → Experiments → Research test; after that I set
  the defaults.
- You kept four of the five taste findings and turned one down; the four are now standing
  instructions the writer reads every time.
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

## State on 19 October

The 19 Oct commission ("next research and integration commission", after the research audit)
is done as far as it can be without Sam's judgments. Read `research/NEXT-COMMISSION-REPORT.md`
first: it separates what was built, what was learned, what the app has actually used and what
has been shown to help (nothing yet). In short:

1. **Pack pilot-1.2** (`research/pack/`, `research/CHANGELOG.md`): quotations checked against
   raw pages, sources reconciled, claim / access / confidence / limits labelled separately,
   room-only advice kept away from the writer, lopsided teaching pairs repaired, every profile
   says what it rests on. Files keep every version; `latest()` loads the newest.
2. **One research boundary** (`Service.research(route, …)`) for Ideas, Create, Develop,
   Journal rewrite / continue and Find the title. Defaults are exactly as before (craft notes
   only for precise rewrites). Settings → Writer → "By task (experiment)": Off / Notes only per
   task, 0–2 cards. The Hang never gets notes. Each run records route, mode, ids, reasons, the
   rendered block and its hash. Real traces: `research/TRACES.md`.
3. **References**: "Noah Kahan, Sam Fender" keeps both (`engine/refsplit.ts`, lookup `ref2`);
   Create sends the checked reference by id so its characteristics reach the writer.
4. **The research test** (`server/trials.ts`, `#/trials`): batch `tb_XwF3_TE7`, eight of his own
   briefs (`research/eval/2026-10-19-research-test.md`), research off vs at most two cards,
   everything else frozen; A/B balanced and fixed; conditions revealed when all are judged.
   **Judged 20 Oct: off 6, on 2** (on won Create and Develop; lost all Ideas, the rewrite,
   continue, title). Repeat of E2/E4/E5/E6 with sides swapped: `tb_q238hjgg` (20 Oct), waiting
   for him. Read with `GET /api/trials/<batch>/tally`.
5. **Taste** (`docs/TASTE-CHAIN.md`): what his 16 answers changed (nothing by themselves; on 20
   Oct he kept four findings as standing lessons and turned one down; two voice examples live). Findings are now kept / turned down / waiting.
   Five quick pairs at `#/taste/contrasts` (optional). His accepted edits per song:
   `GET /songs/:id/edits`; `songHistory` (off) would show them to the writer for that song.
6. **Eight song records** (`research/SONGS-2026-10-19.md`) staged as `pilot-1.3-candidate` in
   `research/pack/candidates/` — **not loaded**; compare with pilot-1.2 only after the test.
   The ballad slice examined "Someone You Loved", which Sam co-wrote.

Earlier state (still true): lessons, ideas at hit scale, learning from outcomes, titles for the
next section, the four destinations, the taste test — details in `docs/BUILD_STATUS.md`.

Last commits: the commission (`e47676d` Phases A–B, `ce05e6d` Phases C–E, then the docs and
traces), `def00f5` (taste test live check).

Loose ends, none urgent:
- Retrieval misfires the traces show (format-word matches; "falling in love… won't work out"
  read as happy love; "in place of" read as a place). Deliberately not tuned before the test;
  fix after his votes if research loses on those cases.
- The judging screen was checked on the stand-in only, so his first view is the recorded one.
- Create's results have no rhyme or title check (Ideas has both, `studio.checkOrRetry`).
- The Anthropic key in Render (named "New no10" in the Console) **expires 3 November 2026**.
  Rotate it per `docs/OPERATIONS.md` before then — he pastes the new key into Render himself.

## The brain, piece by piece

| Piece | Where | What it does | What's in it today (live) |
|---|---|---|---|
| System core | `server/engine/prompts.ts` `PROMPT_VERSION=p2.2` | The writer's standing rules (rhyme words must belong in the scene, etc.) | Fixed text; bump the version to change it, keep old variants verbatim |
| Idea template | `prompts.ts` `IDEA_TEMPLATE=ws5`, `sparkPromptV2` | One-breath concept, title placement, hit-scale examples | — |
| Taste notes + voice | Settings → Your writing; `svc.tasteFor` → `tasteBlock` | His own words on his taste + up to four of his lyrics, read with every request | 0 characters of notes; **2 lyrics** (marked his on the taste test, 19 Oct) |
| Taste test | `server/taste.ts`, `engine/tasteBank.ts`, `#/taste`, `#/taste/contrasts` | Pairs on one hidden axis + guessed weak spots → findings he keeps (or turns down) → standing lessons (source `taste`) | 1 session (16 answers); 5 findings waiting, 0 kept |
| Lessons | `server/engine/lessons.ts`, Settings → Lessons | One instruction per rework note; standing / session; supersedes | 1 lesson ('hall') |
| Learned | `server/learning.ts`, Settings → What it's noticed | Reflects every 10 ideas on outcomes → goes for / passes on | 3 goes-for, 0 passes-on, basis 40 |
| Subjects | `server/engine/barometer.ts` + `research/charts/` | Picks subjects by genre from what charted; `hitConcepts` = real charted situations given as examples | 1,225 songs classified |
| Craft pack | `research/pack/`, `server/engine/pack.ts`, `Service.research` | Retrievable cards/profiles/pairs; per-task switch; a reference pulls the artist's verified profile | pilot-1.2 live (default: precise rewrites only); pilot-1.3-candidate staged; research test unjudged |
| Checks | `engine/rhyme.ts`, `engine/hook.ts`, `shared/lyricShape.ts` | By-sound rhyme check, title placement, line shape; a failed check retries the lines once | Engine-side, no model cost |
| Measuring | `server/evals.ts` (12 briefs), `server/experiments.ts` (blind 3-way), `server/trials.ts` (research test on his own briefs) | The only honest way to know a change helped | Rule: never tune prompts to unfinished blind votes |

## Sam's open question (16 Oct, by voice): "improve its brain and its taste"

What I'd tell him, ranked. Bring him **one question at a time**, and say outright which to do.

**Update 18 Oct:** A is now the taste test (he didn't want to type it). Once he has played a
round, look at what he kept and what he marked "Not me" before choosing between B and C: if
"Not me" lands on most findings, the cards need work before anything else.

**Update 20 Oct:** he kept four taste findings and turned one down. The research test went 6–2
against research. Next: read the repeat (`tb_q238hjgg`); if research loses the rewrite again,
switch it off there. Then stop investing in craft research for the writer and move to his own
taste: B (a reason when he passes on an idea; ideas he loves kept as examples), measured the
same way (taste on vs off on his own briefs).

**A. Fill the empty levers (him, ten minutes, no build).** *(Superseded by the taste test.)* Settings → Voice: five to ten
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
Co-Authored-By: <the model named in this session's attribution reminder>
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
Continue building Songroom (repo romansorchestra/Songroom). Read docs/HANDOFF.md and research/NEXT-COMMISSION-REPORT.md first and follow them. Check whether I've judged the repeat of the research test (tb_q238hjgg); if I have, read the tally, set the research defaults the evidence supports, then move on to the taste work — tell me outright what you did and what's next, one question at a time.
```
