# How the app uses the research (19 Oct 2026)

Plain English first, mechanics after. The 10 Oct version of this file said the pack was "off by default" and version `pilot-1`; both were stale (it was `edits` and `pilot-1.1`). The state before 19 Oct is recorded in `BASELINE-2026-10-19.md`.

## In one paragraph

Every writing action now asks for research through one function (`Service.research(route, …)`). Nothing changed by default: the craft-notes setting (`craftPack`, default **precise edits only**) still decides, exactly as before. What is new is a switch per action (Settings → Writer → "By task (experiment)"), so any one action can be set to **Off** or **Notes only** (at most two notes chosen for that action, nothing else) and set back again. The Hang never gets notes. Every run records what research reached the writer and why.

## Route by route

| Action | API → writer task | Default today | "Notes only" sends | What the writer must still obey | Trace |
|---|---|---|---|---|---|
| Ideas (one at a time, Browse ten) | `/springboard/next`, `/browse/list` → spark, list | **off** (on only if craftPack = all) | ≤2 cards labelled `ideas` | his direction and genre; the engine-assigned subjects and title placements | fixture ✔; live: `TRACES.md` |
| Ideas live check | `/springboard/preview` → preview | follows the Ideas setting; a check can ask for either | same | saves nothing | live: `TRACES.md` |
| Create, a brief | `/messages` → write | **off** (only all) | ≤2 cards labelled `create`; the task is read from the brief | his brief; any song lyric; **the reference now arrives with its characteristics, coverage and what he likes**, not just a name line | fixture ✔ |
| Develop an idea | `/ideas/:id/rework` → rework | **off** (never had research) | ≤2 cards labelled `develop`, chosen from his note with the idea as context | what he marked to keep comes back word for word (engine-enforced) | fixture ✔ |
| Journal: Rewrite / Find a rhyme / Help with a selection | `/songs/:id/suggest` (replace) → suggest | **on** (legacy edits scope: ≤2 cards, matching pack profiles, 1 teaching pair) | ≤2 cards labelled `rewrite`, no pair, no profile | only the selected words change: the server rebuilds every line as prefix + proposal + suffix; locked lines cannot change | fixture ✔ |
| Journal: Continue | `/songs/:id/suggest` (add) → suggest | **off** (only all) | ≤2 cards labelled `continue` | lines are added after the chosen line, never replacing one | fixture ✔ |
| Journal: Find the title | `/songs/:id/titles` → titles | **off** (never had research) | ≤2 cards labelled `title` | the lyric he has written is the brief; no new concept is forced on it | fixture ✔ |
| Hang | `/hangs` → hang | **never**, whatever the switches say | nothing | every candidate is checked word for word against the transcript | fixture ✔ (no notes reach it) |
| Earlier sessions' edit (no current screen) | `/songs/:id/edit` → edit | on (legacy edits scope) | not switchable | as before | — |

"Fixture" traces are in `tests/research.test.ts`: with each action set to Notes only, the stand-in writer receives a prompt containing exactly the block the run recorded, with the chosen cards' text in it. That proves wiring, not better writing. Live traces are listed in `research/TRACES.md`.

## What "Notes only" leaves out, on purpose

- **No teaching pairs.** They are excluded from the 19 Oct on/off test so their effect isn't mixed up with the cards'.
- **No pack profiles in the notes block.** References reach the writer through their own block in both conditions, identically, so the only thing that differs between Off and Notes only is the cards.
- **No session cards.** Eight cards are advice for a person in a room with an artist (`applies_to: session`); they never reach the writer, on any path, including the legacy one.

Explicit instructions and accepted text outrank advice: the block says so ("lenses, not rules; his instruction and his own lyric always win"), and scope, locks and kept lines are enforced in code, not by the prompt.

## What each run records (private, in the app's own database)

`runs.request.pack`, for every research-capable action:

```
{ route, mode: legacy|off|cards, version, task, maxCards,
  cards: [ids], profiles: [ids], pair, reasons: [{ id, score, tags, words }],
  considered, block, hash }
```

plus, on the run row itself, `prompt_version` (e.g. `p2.2+cards/ws5`), `model`, `effort` and `request_id` (the API's generation id). The block is research text only, never a lyric. Nothing is exposed outside the signed-in app; there is no debug feed.

## Several references at once

"Noah Kahan, Sam Fender" used to resolve to Noah Kahan alone, because the first matching pack profile won. Now (`server/engine/refsplit.ts`):

- names the pack knows become their own references; the rest is looked up on its own;
- a lookup can answer "several" and each becomes its own reference; one it can't identify is shown as unverified, not dropped;
- the reference card shows each one separately, each with its own optional "What do you like about …?" field and its own "Not this one";
- titles and names with a comma or "and" in them stay whole when the pack knows them (Tyler, the Creator; Good Luck, Babe!); anything the pack doesn't know is left to the lookup to split;
- a profile's coverage travels with it ("Coverage: Rests on …").

## Mechanics

- `loadPack()` takes the highest version of each record and skips inactive ones (`latest()`).
- `selectForRoute(pack, route, input, maxCards)` filters to generator cards labelled for the route, scores them with the same `scoreCard` as before (direction tags, genre, task fit, word overlap, confidence), keeps those scoring ≥3, at most `maxCards` (0–2), and returns a reason for each.
- `renderCards()` writes the same header as before followed by `problem → technique. Not when: …`, using the generator rewording for cards that apply to both a room and a generator.
- The legacy path (`selectPack` + `renderPack`) is unchanged except that session cards are excluded and a profile's coverage is shown.
- Settings: `researchRoutes` (per action: absent = default, `off`, `cards`) and `researchMaxCards` (0, 1 or 2; default 2).

## How to extend the pack

1. Raw findings go in `research/raw/<slice>/` (see `raw/AGENT_STANDARDS.md`; song analyses follow `raw/SONG_ANALYSIS_STANDARDS.md`).
2. Cards are built by `build_cards.py`, then `build_pack_v2.py` (labels, fixes, versions). A changed card gets a new version line; never edit an old one.
3. Bump `pack_version` in `manifest.json` and add a `CHANGELOG.md` entry whenever retrievable records change.
4. Never add a lyric line. Never add a card whose only evidence is "it's in a hit".
