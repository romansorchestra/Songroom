# Songroom product spec

This is the original handoff (v1.0, 8 Oct 2026) with the amendments Sam agreed on 9 Oct 2026. **Where they conflict, the amendments win.**

## Amendments, 9 Oct 2026

- **Single user, single password.** No multi-user isolation, row-level security or ownership checks. One `APP_PASSWORD`, signed session cookie, a header check on writes.
- **One process, one database.** No separate worker or job queue. A request is stored as a run, executed in the background, polled by the client. On restart, runs left "running" become "interrupted, may have been billed".
- **Model: Claude Opus 5.5 by default.** No up-front model bake-off. Fable 5.1 is selectable in Settings. Astra is not wired (and isn't reachable from the build environment). A blind A/B can be added later if a session feels flat.
- **Personalisation = Sam's own words, not inferred rules.** Settings → Your writing: taste notes in his words plus example lyrics, injected into prompts. The inferred-preference engine (§7) is deferred, maybe permanently.
- **Research module (§6) deferred.** References are a free-text field ("song, and what you like about it") passed to the writer as qualities, never imitation.
- **Suno prompts added** (previously out of scope). Per song: style text, exclude text, and per-section bracketed tags. The writer only produces tags; the server assembles them around Sam's exact lyrics, so Suno output can never alter his words.
- **Tests focus on protecting his words** (edit scope, locks, conflicts, duplicates, spend caps, Suno verbatim). Quality is judged on the live build with real Opus, via the Test pack in Settings.
- **Deferred:** research worker, inferred preferences, generated artwork, voice memos, import/restore UI, print view, blind A/B screen.

---

# Songroom — Claude Code build handoff

Prepared for Sam · 8 October 2026, Los Angeles · Version 1.0

**Read this entire document before coding.** It is a product specification and implementation plan for a private songwriting app. “Songroom” is a working name. Build a useful first release in stages; do not attempt the entire future roadmap at once.

**Reading guide:** Sam can review sections 2–3 for the experience and section 13 for delivery order. Claude should read the entire document. Sections 10–15 define engineering requirements; Appendix A supplies the initial model tests; Appendix B maps the conversation's requirements to the plan. The first useful milestone is much smaller than the complete first release.

## 1. Instructions to the builder

You are building for a professional songwriter/producer. The product must produce useful original song ideas and help improve existing lyrics, while learning from the owner's actual decisions. Writing quality and preservation of his work matter more than feature count.

1. Inspect the target repository, its instructions, and existing work. Preserve unrelated changes. If starting fresh, use the default architecture in section 10. Do not assume files from the ChatGPT environment are available on Sam's computer.
2. Summarise the implementation sequence briefly, create a tracked checklist, then begin. Make routine implementation decisions yourself. Ask only for a genuinely blocking credential, account choice, paid infrastructure commitment, destructive operation, or unresolved creative decision that cannot be handled with a reversible default.
3. Implement milestones 0–5 in order. Each milestone must leave a runnable application. Continue without asking for approval after each routine step. If access is missing, finish the independent work and report the specific blocked integration honestly.
4. Run the risk-focused checks in this document. Show evidence of what works, what was tested with live providers, and what remains simulated or deferred. Never present fixtures as actual model output.
5. Maintain a short `CLAUDE.md`, `docs/BUILD_STATUS.md`, `docs/DECISIONS.md`, and `docs/OPERATIONS.md`. Keep this specification as `docs/PRODUCT_SPEC.md`. Record decisions and commands so another session can resume without reconstructing the conversation.
6. Build and test locally first. Prepare a private deployment configuration and cost estimate; do not purchase infrastructure or publish without the user's applicable authorisation. This handoff itself does not supply credentials or authorise unlimited API spending.

### Existing work and authority

An earlier ChatGPT attempt created a starter site/project named Songroom, but the build was paused before product implementation or publication. It is not a completed app or a required hosting destination. No source archive accompanies this handoff. Do not depend on its identifiers, temporary credentials, or environment. Reuse an existing repository only if Sam provides it and inspection shows that doing so is appropriate.

This document consolidates the conversation. Explicit new instructions from Sam override it. Product choices below are recommended engineering defaults, not claims that Sam selected every technology or numeric threshold.

## 2. Product goal and boundaries

**A quiet writing room and an evolving illustrated notebook of song ideas.** Sam can open it without a song in progress, ask for ideas, save the promising ones, or paste a lyric and get precise suggestions. The machinery for research, personalisation and model testing stays behind the writing experience.

An **idea** means a title, a clear song concept, and a few original lines to build from. A **song** is an evolving piece with its own perspective, story, accepted text and open problems. An **experiment** compares alternative models or writing strategies without revealing their identities before judgment.

### Success means

- Sam gets ideas he would actually develop, including occasional exceptional lines that unlock a song.
- Small edit requests stay small. Accepted words, line breaks, rhythm instructions and narrator intent survive.
- Work is never silently lost, replaced, or trapped in one model provider.
- Feedback improves relevant future suggestions without flattening different genres into one house style.
- Costs, waiting times and quality can be compared honestly.
- A phone is useful for collecting and reading ideas; a computer is useful for longer writing. Core features work on both.

### Not part of the first release

Public social features, payments/subscriptions for other users, collaborator accounts, label pitching, DAW integration, Suno integration, music production, generated singing, perfect audio-to-lyric alignment, model fine-tuning, large-scale lyric scraping, or autonomous self-modifying code. These must not become hidden dependencies for the basic app.

## 3. Interface: two main places

### Write

One composer: **“What are you working on?”** An optional **Add a reference** control accepts a song title and artist, a link, or multiple references when requested. There is no mandatory genre questionnaire, artist picker, rhyme panel or model menu before writing.

Example requests:

- “Give me five country ideas about realising something too late.”
- “Give me three strange relationship concepts. No specific artist.”
- “Here is my chorus. Replace the last two lines, keep the rhythm, and end on ‘losing you’.”
- “More like the thinking behind number three, but with a different image.”
- “Same idea from her perspective.”
- “Give me something outside what I normally like.”

Infer the task from the request and selected text. A selection plus “replace this” is a constrained edit, not a request for a new song. Use a compact, dismissible interpretation only when useful: “Keeping the first six lines; changing the final two.” Ask one short question only when ambiguity would materially alter the work. Otherwise produce something useful with a stated, reversible assumption.

Default outputs: three ideas for a broad request; three alternatives for a line edit. Respect explicit counts. An idea card shows title, concept and two to four starting lines without a long explanation of why they are supposedly good. Primary actions: **Save**, **More like this**, **Edit**. Secondary actions belong under a menu or text selection: develop into a song, save one line, mark exceptional, dismiss, history, sources, copy.

“Edit” on a saved card opens direct editing. Selecting lyric text also offers “Suggest changes”; contextual requests must distinguish these actions. A conversation can discuss writing normally without generating cards every time.

When developing a song, show its text in a simple editor alongside the conversation on desktop and as a toggle on mobile. Use stable section and line identifiers. Avoid a full rich-text editor in v1; a section/line editor with plain text is easier to make reliable. Preserve exact pasted line breaks. Version every accepted edit.

### Journal

Saved seeds and song pages, readable and editable, with understated artwork. Search across titles, concepts, lines and notes. Offer compact filters for favourites, collections and dates; do not create a navigation tab for every taxonomy.

All generated results are retained in session history so an unsaved idea is recoverable. **Save** curates an item into the Journal; it is not the only persistence operation. A small “Recent sessions” entry exposes unsaved material without cluttering the notebook. Saving the same revision twice does not duplicate it.

Pages can contain the title, concept, original seed lines, current draft, notes, references, and later a voice memo. Developing a seed preserves the seed's original form and links it to the song. Collections are optional and non-exclusive. The app can suggest tags, but does not force filing.

### Quiet settings

A single settings menu contains Connections & spending, Test models, What I've learned, Export/backup, and appearance. Experiments are accessible, not a third primary workspace. Model controls must not dominate writing.

The app should feel like a contemporary notebook: warm restrained palette, strong typography, generous space, readable line breaks. Avoid dashboard tiles, badges everywhere, fake leather, excessive animation and artwork behind lyrics. A clean reading view is always available. Keyboard navigation, visible focus, screen-reader labels and usable touch targets are required.

## 4. The four writing behaviours

These are internal task types, not four mandatory screens.

| Task | Behaviour | Must preserve |
| --- | --- | --- |
| Find the song | Distinct titles, concepts and seed lines | Requested count, perspective, creative direction |
| Find the line | Strong lines inside an existing song | Story, voice, surrounding text and requested placement |
| Fix this | Targeted alternatives for selected wording | Locked text, exact edit scope, explicit ending/rhyme/rhythm instructions |
| Push this further | Explore or develop a promising idea | The chosen core unless a change is explicitly proposed |

### Song understanding

Maintain a small, editable song brief: narrator, addressee, relationship/time setting, central situation, emotional contradiction or discovery, title meaning, what each section reveals, accepted facts, and unresolved questions. Every inferred fact has a confidence/state: user-confirmed, provisional, or disputed. Do not turn guesses into canon. Current user instruction wins over inferred brief, which wins over broad taste preferences.

Full lyrics, if requested, respect the requested structure. The historical example used verse, pre, chorus, verse 2, pre, chorus, bridge, chorus. Do not impose this structure on all songs.

### Precision lessons from this conversation

The working idea moved from “practicing leaving” to “practicing losing.” The narrator did not realise that repeated neglect was preparing him to lose her. Deliberately planning a breakup would change the concept. Sam specifically wanted the chorus to start **“I was practicing losing”** and eventually land on **“losing you.”** He did not ask for a complete rewrite every time a word changed.

Other explicit requests included keeping the rhythm, replacing a repeated word in the bridge while retaining a rhyme, changing “Quit” to “You stopped getting mad,” and changing a verse timing detail to “saw the pictures when you got home.” These illustrate exact edit scope and narrative continuity, not universal songwriting rules.

The user supplied the opening wording “you got used to leaving lights on, and plates by the stove.” Preserve it when a task says it is accepted. The conversation does not establish a reliable final approved version of the entire song or of the later “nothing to lose” option. Do not fabricate one or install a guessed completed song in his Journal. Benchmarks below are labelled fixtures, not historical drafts.

### Constraints and singability

Support exact ending phrases, rhyme targets, exact/slant rhyme preference, forbidden words, required words, line count, approximate syllables, stress templates, perspective, section order and locked spans. Infer from natural language, and show editable constraint chips only while relevant.

Separate **hard constraints** (locked text, number of lines, exact ending, forbidden tokens) from **soft assessments** (natural stress, emotional plausibility, rhyme quality, singability). Validate hard constraints in code. Use pronunciation data where available for English syllables/rhymes; proper nouns, dialect, elision and sung pronunciation remain uncertain. Never call a syllable estimate exact melody matching. Allow manual correction. Final stress and vowel fit need Sam's ear.

An unambiguous literal operation such as replacing one specified word can be performed deterministically and previewed without paying an LLM. Record it as a direct edit, not model output. Such operations test application correctness; exclude them from creative-model win rates. The provider-only instruction-following benchmark may still send the same fixture to each model and must be labelled separately.

Rhyme must follow sound, not spelling. Do not damage meaning or syntax just to meet a rhyme. If constraints conflict, explain the specific conflict and ask which can move; do not silently relax one. Lexical matching must define case, punctuation and inflection behaviour explicitly, with exact preservation for locked text.

## 5. References and creative direction

Allow a fresh reference each time without setup. The title/artist field resolves candidates; do not silently choose the wrong song, a cover, or a live version. If title plus artist is unique, show the resolved song as a chip that can be corrected. If ambiguous, ask the user to select. Pasted links are metadata references; a streaming link does not mean the app has permission or technical access to the full audio or lyrics.

Optional question: **“What do you like about it?”** Examples: emotional angle, social detail, humour, title payoff, rhythmic density, directness. If omitted, show a brief interpretation, such as “Taking the conversational detail and delayed title payoff.” Distinguish user description from sourced analysis and model inference. If the song cannot be verified, say so and allow the user to describe it; never invent detailed analysis.

Artist names are shorthand, not sufficient specifications. Olivia Rodrigo, Tyler, the Creator and Morgan Wallen were examples of very different possible directions. Translate references into editable characteristics: emotional posture, narrator, diction, specificity, rhythmic density, humour, imagery, structure, title mechanics and audience/project. Do not generate celebrity impersonation profiles or promise indistinguishable imitation. Create original writing from the requested general qualities and honour applicable provider constraints.

Keep three separate layers:

1. **Current task/song constraints:** highest priority and temporary unless explicitly saved.
2. **Project or creative-direction preferences:** country pitches, confessional pop, character-led hip-hop, or named projects Sam introduces.
3. **General taste:** recurring preferences supported across contexts.

“For that country project again” can retrieve remembered direction. No visible profile setup is required. Explicit per-song reference overrides the default direction for that request. References influence only the role assigned to them; if one supplies humour and another structure, do not blend everything indiscriminately. Reference and taste versions used in a generation are recorded.

Include an exploration instruction through natural language: “outside my usual taste.” It temporarily broadens the candidate pool; it does not erase preferences. Preserve counterexamples to prevent repetitive safe writing.

## 6. Research that earns its place

The app should research songwriting craft, successful songs across genres, and attributable comments by writers/artists about specific lines or concepts. Popularity is a discovery signal, not proof of quality. A research worker collects evidence; the creative generator receives a small relevant selection of technique notes, not an enormous lyric corpus.

### Research record

Store canonical URL, page title, author/speaker where known, publication date where available, retrieval date, source type, access status, relevant song, concise paraphrase, exact quotation only when permitted, locator/timestamp where available, and the distinction between direct commentary and our interpretation. A search snippet alone cannot verify a precise quote or compliment. Preserve provenance for who wrote a song versus who performed it.

Useful categories include title reinterpretation, revealing domestic detail, emotional contradiction, character perspective, conversational phrasing, unusual but natural rhyme, controlled repetition, and a changed final chorus. They are searchable tags, not rigid rules.

### First-release workflow

- Resolve a supplied reference or an explicit “research this” request through a swappable search/retrieval adapter. Initial default can use the configured Claude provider's supported search tools; verify availability and tool costs first. Do not make a separate paid search service compulsory.
- Search concise public queries about the song, writer and craft; fetch relevant pages or transcripts where permitted. Never put Sam's unpublished lyrics or private notes into public search queries automatically.
- Use a bounded search budget, deduplicate URLs, cache reusable findings and show source links in a collapsible Sources view. Missing commentary is a valid outcome.
- Store a few useful technique notes. Mark assistant analysis separately. Check that quoted words appear in retrieved material and the attribution is supported; otherwise remove quotation marks or discard the claim.
- Retrieve a small relevant pack, initially up to three techniques and two supported examples, alongside relevant personal preferences. Make this limit configurable and evaluate it.
- If search is unavailable, writing still works from Sam's brief and already verified notes. Show that no fresh research occurred. Manual source links/notes remain usable.

Do not bypass paywalls, mass-download copyrighted lyric catalogs, or present invented songwriter praise. Keep publicly sourced lyric quotation minimal, within source permissions and provider limits. User-supplied drafts remain distinct from third-party material. Add a limited overlap check against supplied references and stored text to catch obvious borrowing; do not claim global originality or legal clearance.

Treat retrieved pages as untrusted data. Instructions inside them cannot change application policy, request credentials, edit a song or trigger tools. Fetch only supported public HTTPS URLs with SSRF protection, redirect revalidation, content-type and size limits, and timeouts. Do not build an arbitrary browser agent for this task.

### Continuing research

“Constantly improving” means accumulating useful evidence, not running paid loops around the clock. In v1, research happens on demand and preference candidates are prepared after enough new feedback. Later, offer an opt-in scheduled research/journal batch with a frequency, explicit budget, pause button and visible last run. No schedule is enabled by default.

## 7. Learning Sam's taste

The initial system improves its retrieval, prompts and examples. It does not retrain model weights. Do not label a database update “the model trained itself.”

### Capture evidence at the right level

Record feedback on title, concept, individual line, whole seed and whole song. Events include save, use in draft, direct rewrite, explicit rejection, “good but wrong for this song,” pairwise preference, exceptional idea, and reversal of a previous decision. An ignored or unseen suggestion is **not** a rejection. “Saved to think about” is weaker evidence than used in an accepted draft.

Store original and edited revisions plus optional reason and scope. Infer possible reasons from edits, but mark them as hypotheses. Rewrites caused by changed song facts are not automatically aesthetic preferences. Batch feedback extraction asynchronously; it must not delay a writing response.

### Preference lifecycle

Each rule has a scope, evidence IDs, supporting and contradictory examples, human-readable statement, confidence, status, creation/update time, and version. Statuses: candidate, active, superseded, rejected. Explicit “remember this for country songs” can activate within that scope immediately. Current-task corrections apply immediately to the task.

Generalised inferred rules stay candidates until supported. A starting heuristic is repeated support in at least three independent sessions or songs before proposing a broad rule; this is a conservative product default, not a validated statistical threshold. Several clicks on the same idea count as one underlying example.

The Settings → What I've learned page allows inspect, correct, disable and delete. Do not interrupt every session for approval. Summarise useful candidates occasionally, or include them in a short blind comparison. Prevent contradictory rules from accumulating silently: prefer narrower scope, newer explicit instructions and stronger evidence. Record the conflict rather than overwriting history.

### Test before promoting a writing strategy

Maintain a versioned baseline and candidate bundle: prompt version, active preferences, retrieval rules, model/effort and source-pack versions. Compare baseline and candidate with the **same model first**, changing one factor at a time where possible. Include retained briefs and fresh held-out briefs; exclude held-out answers, ratings and rules derived from them from candidate creation. If a holdout is used repeatedly to tune, retire it into development data and replace it.

Only Sam's observed preferences establish personal writing quality. AI reviewers can flag concrete problems but cannot certify “Sam likes this better.” Small samples are directional, not proof. Keep the current baseline on an inconclusive result. Promotion is reversible and the UI explains what changed without exposing chain-of-thought.

Rollback changes future behaviour, not existing lyrics. Forget/delete removes affected evidence from future retrieval and invalidates dependent preferences; explain backup expiry separately. Keep the system capable of surprising him instead of overfitting to familiar titles, domestic imagery or country wordplay.

## 8. Model testing and economics

The first useful release includes a hidden Test models screen and a reusable benchmark pack. Model adapters must be interchangeable. The ordinary Write screen uses one chosen default; it does not call every provider on every request.

### Starting candidates, not a predetermined winner

Documentation checked 8 October 2026 in Los Angeles:

| Candidate | API ID | Standard text input / output per million tokens | Initial role |
| --- | --- | --- | --- |
| Claude Opus 5.5 | `claude-opus-5-5` | $4 / $20 | Practical starting default to test |
| GPT-6 Astra | `gpt-6-astra` | $10 / $50 | Challenger; compare medium and max effort |
| Claude Fable 5.1 | `claude-fable-5-1` | $10 / $50 | Optional challenger, not required to launch |

These IDs/prices are time-sensitive snapshots from official documentation [S1] and [S2]. Verify the user's actual access, current pricing and supported parameters before enabling them. Do not invent replacements if a requested model is unavailable. Register an alternative explicitly. Cached input, reasoning/output usage, tools and other modes change real cost; headline rates alone do not predict cost per usable idea.

Astra documents `low`, `medium`, `high`, `xhigh`, `max` effort [S1]. Do not assume Claude uses the same request fields or that equivalent labels mean equivalent compute. Opus 5.5 uses adaptive thinking, and its output cap includes thinking and visible output; implement its current documented request shape [S5]. More reasoning is not established to produce better lyrics.

### Subscription versus app operation

Sam has Claude Max. Interactive Claude Code can use the subscription when signed in accordingly; a globally supplied `ANTHROPIC_API_KEY` can switch Code to API billing [S4]. Keep app runtime keys in the app's local/host secret configuration, not a global shell export that unintentionally changes Code billing. Never extract session cookies or subscription tokens to power the app.

Anthropic currently documents claimable monthly API credits of $100 for Max 5x and $200 for Max 20x, with eligibility/linking requirements and rollout limitations [S3]. Sam must check and claim his actual entitlement in Claude's web billing settings. The app still needs a Console API key. Credits are finite and separate from interactive Code allowance. They do not pay for OpenAI usage, hosting, storage or third-party services. Never promise zero running cost or assume an account balance the app cannot read.

### A fair comparison

Freeze the exact request, song revision, reference pack, preference version, output count and task constraints. Send that same semantic context to each candidate, adapting provider syntax only. Research is resolved once before the comparison; do not give one candidate extra search tools, a different editor or a richer taste history. Test an entire pipeline separately if that is the intended experiment.

Run selected candidates concurrently with bounded concurrency, initially two. Treat provider+model+effort as a distinct configuration. First use Opus versus Astra medium; compare Astra medium versus max separately if budget permits. Fable remains optional. Repeat the same briefs across two independent generations to reduce the chance of selecting a lucky sample. No seeds or determinism are promised where unsupported.

Randomise A/B positions per trial, store the mapping server-side, and return only neutral result IDs before judgment. Model names, provider request IDs, costs and model-specific wrapper text must not leak in comparison JSON, HTML, asset names or client logs. Authenticated usage pages should not reveal an active blind trial's mapping. Perfect blinding against inference from writing style is impossible; avoid avoidable identity leakage.

Record preference as A, B, tie, neither, or skip; allow judging title, concept and lines separately. Save component feedback independently of the overall vote. Reveal models and cost after voting, or after an explicit reveal that marks the trial unblinded and excludes it from blind-quality aggregates. Failure on one side is not a win for the other.

### Measurements

- **Useful-result rate:** rated completed briefs with at least one “would develop/use” result, divided by rated completed briefs.
- **Exceptional-result rate:** briefs with an explicitly marked exceptional idea; report separately from average usefulness.
- **Blind preference:** wins/losses/ties/neither per configuration pair and task type; count briefs, not correlated lines as independent samples.
- **Revision burden:** optional “usable / small edit / substantial rewrite”; text edit distance is a secondary diagnostic, not a quality verdict.
- **Cost per useful result:** attributed generation, repair, research and tool cost divided by useful results; show sample count and failures. Zero useful results displays “no useful results,” never division by zero.
- Latency, hard-constraint failures and provider failure rate. Report how much output remains unrated to expose selection bias.

Compare genres/task types separately. Do not switch defaults automatically from a few votes. If quality is close, prefer the cheaper candidate; an expensive model can remain a deliberate option for difficult work. Preserve actual settings and timestamps so future upgrades can be retested.

### Missing keys

With only Claude connected, the app still works and can compare Claude configurations or accept manually imported results. Imports are marked **external; model/settings claimed by user; cost/timing unverified** and excluded from verified API cost summaries. Without any provider, users can write, edit, save and export; generation clearly says it needs a connection. No fake completed generations or inflated capability claims.

## 9. Journal artwork, portability and future audio

### Make the notebook attractive without making artwork a dependency

The first release includes an illustrated/decorated page system using a small bundled set of original SVG botanical, abstract, architectural or object motifs and restrained paper/ink themes. Keep lyric text as real selectable text; never bake it into a generated image. Assign artwork deterministically per page and persist the selection so it does not change on refresh.

Optional generated artwork comes after saving an idea, through an explicit **Illustrate page** action in its menu. Use a separate image-provider adapter and show the estimated cost. Derive a short visual brief from the concept, excluding names or private details unless requested. Artwork should suggest the idea, not reproduce album covers or artist likenesses. A text model connection does not imply access to image generation.

Run illustration as an independent job. On failure, keep the existing page and motif. Store the visual-brief version and associated idea revision; editing words never automatically regenerates or charges for an image. Offer replacement and removal. In a blinded experiment, use identical plain formatting and no artwork until after the vote.

Journal export: readable Markdown and a complete versioned JSON/ZIP backup in v1; print-ready HTML with a Save as PDF workflow for selected decorated pages. Inspect print output for long titles, multiline lyrics and page breaks. A later server-rendered PDF/book export can share the same template; do not make a rendering service necessary for v1.

Export must include original and current text, revisions, source provenance, reference assignments, feedback, taste versions, collections and asset files/manifests. Exclude credentials, session tokens and provider hidden reasoning. Keep licensing metadata for included assets. Implement import with schema validation, dry-run summary, stable identifiers, duplicate handling and a transaction boundary; reject traversal paths in ZIPs. A backup is not complete until a restore has been tested.

### Audio roadmap

Phase later: attach private voice memos; transcribe with editable text; select a sung phrase and mark its start/end; derive tentative syllable/stress slots and held vowels; propose lyric fits with audible or visual alignment assistance. Start with human-correctable slots. Spoken transcription is not melody transcription, and a model that cannot consume audio cannot evaluate a sung phrase directly. No exact timing or performance-quality claims until demonstrated against real recordings. Audio providers/storage incur separate costs and consent considerations. Do not expose dead audio controls in the first release.

## 10. Default technical architecture

**Recommended starting stack, not a demand to replace an existing sound codebase:** TypeScript, Next.js using the Node runtime, Postgres, Drizzle for typed repositories/migrations, Zod at boundaries, Supabase Auth and private Storage, and a Postgres-backed job worker using pg-boss. Use Vitest for deterministic unit/integration tests and Playwright for key browser flows. Pin compatible stable dependencies and commit the lockfile; verify current package documentation before using APIs.

One repository, one shared domain layer, two processes: web and worker. Supabase can supply Postgres/Auth/Storage. A Node-capable host must run both processes, with TLS and restart policies. Do not put a permanent worker or long model call inside an ephemeral browser session or short-lived Edge request. Use the same architecture locally, with the documented local Supabase setup if available. Hosting choice and paid provisioning are a final setup decision, not an excuse to delay local work.

pg-boss supplies durable Postgres-based work scheduling [S6]. Supabase supports server-side authentication patterns [S7]; database grants and RLS must be configured deliberately, and privileged roles can bypass policies [S8]. Validate the chosen DB connection mode, TLS, roles and queue operations against the actual deployment; do not assume every pooler mode supports every worker feature.

### Module boundaries

```text
src/app/                 Write, Journal, Settings, authenticated route handlers
src/domain/              Song/idea/revision rules; constraints; feedback; experiments
src/contracts/           Versioned Zod schemas and generated shared types
src/server/auth/         Verified owner context; session handling
src/server/repositories/ Owner-scoped persistence and transactions
src/server/providers/    Claude, OpenAI, search and optional image adapters
src/server/generation/   Context builder; orchestration; deterministic validation
src/server/learning/     Evidence extraction; candidate preferences; promotion
src/server/jobs/         Queue handlers, recovery, budgets and cancellation
src/server/export/       Portable backup/import and journal rendering
src/worker.ts            Worker entry point using the same domain code
db/                      Versioned migrations, roles and policies
evals/                   Brief fixtures; no private lyrics in a public repository
tests/                   Invariant, integration and browser tests
docs/                    Specification, decisions, build status and operations
```

The exact directory names are flexible. The separation is not: UI code never calls model providers directly or owns the canonical lyric state. Provider SDK objects do not become database schemas. Do not add a generic agent framework, vector database or distributed microservices unless a demonstrated need justifies them. Start with Postgres search and tagged retrieval; add embeddings only if retrieval quality measurements warrant it.

### Authentication and data ownership

- Single owner initially; public sign-up disabled. Configure the allowed identity through secure setup, not a hardcoded guessed email. Use verified auth claims, not a client-supplied owner ID.
- All content and cost-bearing endpoints require authentication. Every owned entity and query includes the verified owner. Compound foreign keys or equivalent checks prevent a child record referencing another owner's parent.
- Keep application/queue tables in private schemas; no direct browser access to raw runs, experiments or credentials. Server repositories enforce ownership. Apply RLS/least privilege as defence in depth. If direct Postgres uses transaction-local owner claims, set them from verified context on every transaction with a non-bypass role; test pooled-connection isolation. Migration/admin credentials are not runtime credentials.
- Workers receive a validated job ID, load its owner and immutable snapshot, and use owner-scoped repositories. Do not trust arbitrary owner or provider configuration fields in queue payloads.
- Supabase Storage buckets are private; signed URLs have short expiry. Export download ownership must be checked too. Journal assets and drafts are never public by default.
- Verify sessions on server requests, handle expiry/refresh, protect state-changing requests against CSRF as appropriate, and never cache private responses across users. Do not implement authentication from scratch.

### Core records and invariants

Use relational columns for identity, ownership, status and relationships. Use versioned JSON for flexible payloads such as a constraint set, never one giant “app state” document. Entity IDs are server-generated opaque identifiers. Clients may generate validated idempotency/event tokens; these are not trusted ownership or record identifiers. Timestamps are UTC; display in the user's timezone, initially America/Los_Angeles.

| Record group | Required contents and invariants |
| --- | --- |
| Workspaces/threads/messages | Owner, optional project/song, immutable message text/revisions, task intent, ordering; editing an earlier message creates a branch/snapshot |
| Projects/directions | Named context, reference assignments and scoped preferences; optional, never required before writing |
| Ideas/idea revisions | Title, concept, stable line IDs, parent/fork links, source run, saved status, artwork and collection links |
| Songs/song revisions | Brief, sections, line IDs/text, locks, base revision, accepted revision; revisions immutable |
| References/research notes | Resolved song metadata, assigned influence, verified sources, access/retrieval dates, interpretation status |
| Generation runs/candidates | Frozen input/context, model config, prompt/schema versions, status, provider request IDs, parsed output, validations, timestamps |
| Feedback events | Target type/ID/revision, action, optional reason/scope, original and edited text, reversal link; append-only while retained |
| Preferences/bundles | Evidence and counterevidence links, scope/status/confidence, version, activation/rollback history |
| Experiments/trials/votes | Frozen brief/configs, hidden A/B assignment, independently generated outputs, votes/reveal state, holdout flag |
| Assets/export jobs | Private storage key, type, owner, checksum, generating run/revision, deletion state |
| Usage/budget reservations | Provider, model, token/tool usage, actual/estimated/unknown charge, rate version, reservation and settlement IDs |

Use database uniqueness for idempotency keys, revision numbers, candidate-per-run keys and event IDs. References that could otherwise cross owners need constraints. A saved item retains the exact revision Sam saved even if its source is edited. Deleting an idea must not silently destroy a developed song that references it; unlink or present the consequence.

### Versioned API boundaries

Use discriminated request/response schemas. An internal generation request contains task, prompt, optional song/base revision and selected line IDs, constraints, references, context-bundle version and requested count. Model configuration is resolved server-side. A response contains candidate data, concrete validation findings and source IDs; it never contains provider hidden reasoning.

Recommended endpoints/actions:

| Operation | Contract |
| --- | --- |
| Start generation | Validate/authenticate, snapshot input, reserve spend and enqueue; return `202` plus run ID; reuse on duplicate idempotency key |
| Get run | Owner-checked status and completed candidates; blind trials use a separate redacted projection |
| Cancel run | Mark cancellation requested and stop pending work; report already-completed work honestly |
| Accept edit | Requires expected revision and selected line IDs; atomic patch plus new revision; stale revision returns `409` |
| Save feedback/idea | Client event/idempotency ID; stable target revision; safe on retries |
| Resolve reference | Candidates with verification state; never silently changes an existing song reference |
| Create/vote/reveal trial | Server-owned assignments and eligibility; votes revisioned; revealing disqualifies subsequent blind votes |
| Export/import | Authenticated job; schema version and dry-run validation; no secrets |

Return actionable typed errors with a correlation ID, not a stack trace. Derive UI status text from server state. Bound request bodies, result counts, reference counts and uploaded file sizes. IDs in URLs are not authorisation.

For word-level edits, capture the base revision, line ID, expected selected text and exact uneditable prefix/suffix. Use one documented offset convention throughout the editor/server when offsets are needed. The server reconstructs the new line from the permitted replacement span; a provider cannot alter surrounding text by returning a whole-line rewrite. Test repeated words, curly apostrophes, emoji and pasted CRLF line endings. Line insertion/deletion is a separate explicit operation; the first EditProposal schema below intentionally covers replacements only.

## 11. Generation pipeline and recovery

### Normal request

1. Authenticate and resolve task. Where selection clearly establishes an edit, use deterministic routing; do not spend a separate expensive model call classifying every message.
2. Load the exact accepted song revision, relevant brief, user constraints, active preferences, reference interpretation and small research pack. Include relevant recent turns, not unlimited history. Explicit exclusions/locks must survive context trimming.
3. Freeze this input snapshot with its versions and hashes. Reserve a conservative cost ceiling and persist the run plus its enqueue/outbox intent atomically.
4. A worker calls the selected provider using a bounded token/tool/time budget. Versioned prompts request structured output suitable for the task. Use current provider-supported structured output; do not rely on regex extraction from arbitrary prose as the normal path.
5. Validate schema and hard constraints in code. For ideas, request distinct conceptual angles; do not merely change a title's synonyms. A short second pass can improve candidates only if measured useful, capped and included in costs. No uncontrolled generate-critique loop.
6. Allow at most one schema/constraint repair call per candidate in the initial configuration. Repair only the broken constraint, preserve the brief, and record it. If still invalid, show a clear failure or separate “does not meet your constraint” candidate; never imply compliance.
7. Persist complete candidate(s) and usage transactionally, then expose them to the user. Incomplete streamed JSON is never a saved lyric. v1 can use polling and complete cards; streaming is optional polish, not essential infrastructure.
8. Sam chooses a suggestion. Show the proposed edit/diff before acceptance. Check the base revision and apply only permitted line/span changes. If he edited elsewhere while the model worked, rebase only when deterministic and safe; otherwise show the conflict. No last-write-wins lyric replacement.

### Run lifecycle

Use explicit states such as `queued`, `running`, `succeeded`, `partially_succeeded`, `failed`, `cancel_requested`, `cancelled`, and `needs_reconciliation`. State transitions are checked server-side. Candidate status is separate so one successful comparison side can be retained if another fails.

Persist jobs before starting API work. Use a transactional enqueue/outbox pattern supported by the selected queue integration so a committed run cannot be lost between DB write and enqueue. Workers need bounded leases/heartbeats, recovery for stale work, and idempotent persistence. Refreshing the browser, closing the tab or reconnecting a phone must not create a new paid request.

**External API calls and database writes cannot generally form one atomic transaction.** A worker can crash after a provider accepted a request but before a result was saved. Do not promise exactly-once API billing. Store request IDs as early as available; reconcile/retrieve if supported. Mark uncertain attempts and keep a conservative spend reservation. Do not automatically replay a possibly billed request without supported idempotency or an explicit user retry. A retry is a new recorded attempt, not a fabricated continuation.

Retry bounded transient errors with backoff and jitter only when safe. Authentication failures, insufficient balance, unsupported parameters and invalid requests should surface without repeated spend. Provider refusal/content-policy errors are not retried across providers to bypass restrictions. Do not silently substitute another model in a trial or in an explicitly selected generation.

Cancellation is best effort: stop queued jobs and later stages, abort the HTTP request where supported, but explain that already-started provider work may still be billed. A late successful result must not overwrite newer work or resurrect a deleted object. Track deletion/cancellation tombstones and check them before commit.

### Draft reliability

Debounce autosave, show saving/saved/offline/error status, retain a local recovery copy of unsaved text in IndexedDB, and reconcile by server revision. Local storage is a recovery layer, not the only database. Two tabs/devices editing the same revision must get a conflict or explicit merge. Never overwrite text silently. Local backups and caches clear appropriately on sign-out and explicit delete, with a warning/export route for unsynced edits.

### Cost control

Every paid path, including search, repairs, evaluations and images, goes through one server-side budget service. Configure per-request, daily and monthly limits; no unlimited default. Before the first live session, show and let Sam set a ceiling. Reserve estimated upper bounds atomically across concurrent jobs so simultaneous calls cannot each spend the same remaining allowance. Cap input/output/tool calls to make reservations meaningful; reject unknown-priced operations until configured or explicitly allowed with a bound.

Track actual reported usage, cached tokens and provider-specific reasoning accounting without double counting. Rates are dated/versioned; unknown cost is unknown, not zero. Settle reservations once, retaining uncertainty when usage is unavailable. Provider invoices/console balances remain authoritative; app limits are protective controls, not a billing guarantee. Do not infer remaining subscription credits from local call history. Failed and cancelled calls may cost money.

Use a small clear receipt in Settings, not a ticker in the writing area. Repeated requests with different prompts are new runs; identical client retries use the same idempotency key. Redact API keys and lyric payloads from routine telemetry; log IDs, statuses, timings and counts. Keep user-accessible generation records private.

## 12. Prompts and quality control

Prompts live in versioned files with tests against their structured contracts. Avoid giant accumulating system prompts. Assemble only relevant context in this priority order: app constraints and provider rules; current user request; locked/accepted song text and explicit song facts; current reference direction; active scoped taste; a few supporting examples; optional craft research.

### Base creative instruction, to refine through evaluation

“Produce original, usable songwriting material for this brief. Preserve narrator intent, concrete song facts and explicit constraints. Favour language that feels spoken or sung naturally in the requested context. When asked for ideas, offer different underlying situations or emotional discoveries, not near-duplicate titles. Build seed lines from the concept rather than adding unrelated clever sentences. Do not claim every suggestion is strong or explain obvious wordplay. For a targeted edit, change only the authorised text. Keep evidence-based source claims separate from your creative interpretation.”

This is a starting instruction, not a universal aesthetic formula. Country may reward title turns and plain detail; other briefs may reward obliqueness, fragmentation or surreal character. Do not force every genre into confession, domestic scenes, a pun or a twist ending. Do not hardcode a blanket ban on ordinary words or a generic “avoid clichés” list that removes useful language.

### Quality checks

Deterministic checks: valid schema, counts, exact endings, forbidden/required text, untouched locks, edit scope, duplicate candidate IDs, references that exist, and schema/version bounds. Heuristic checks: near-duplicate concepts, possible reference overlap, timeline contradiction, forced grammar, redundant lines and uncertain phonetics. Show only findings that matter; a heuristic is advisory, not proof.

An optional critic should state a specific issue (“this makes him aware of the breakup too early”), with a suggested revision or uncertainty. Do not show self-awarded quality scores or discard all eccentric ideas through an AI judge. On a blind model test, run the same deterministic checks for both candidates and no unrecorded subjective rewriting. Preserve original outputs and any repair lineage.

### Typed output sketch

This illustrates the required separation; implement real Zod schemas rather than copying unvalidated casts.

```ts
type Task = 'ideas' | 'lines' | 'edit' | 'develop' | 'discuss';
type Seed = {
  title: string;
  concept: string;
  lines: Array<{ text: string }>;
};
type EditProposal = {
  baseRevisionId: string;
  replacements: Array<{ lineId: string; expectedText: string; newText: string }>;
  // IDs and expected text are verified against the snapshot, never trusted.
};
type ProviderResult = {
  output: unknown; // Parse with the task's versioned schema before persistence.
  providerRequestId?: string;
  usage: NormalizedUsage;
  finishReason: string;
};
```

Assign permanent idea/line IDs server-side after validation. Store provider-native usage alongside normalised usage for audit. Do not store hidden chain-of-thought or treat it as a learning corpus.

## 13. Implementation milestones and exit gates

Do not build all screens first and connect them later. Implement complete paths through UI, persistence, provider and recovery. A milestone can be reviewed without being publicly deployed.

### Milestone 0 — Foundation and a verifiable plan

Inspect/create the repo, document architecture choices, pin dependencies, create domain schemas, migrations, local auth setup, web/worker commands, `.env.example` with empty placeholders, lint/typecheck/test/build scripts, and CI without live-provider spending. Establish a private git repository if authorised/available; otherwise leave the local repository ready to connect. Never commit secrets or Sam's drafts as public fixtures.

Verify current model IDs/capabilities and SDK request shapes. List required credentials and explain how to supply them securely. Do not silently install a new paid service. Build labelled provider fixtures for development and separate them from real runs.

**Exit gate:** a fresh checkout starts from documented commands; migrations apply to an empty local DB; auth/owner isolation is tested; missing connections show honest states. Record exact commands and any environment limitations.

### Milestone 1 — First useful writing and comparison

Build Write, one live Claude adapter, optional OpenAI adapter, bounded queued generation, valid title/concept/line cards, save/edit, a plain Journal, recoverable sessions and Markdown export. Add a minimal hidden A/B comparison for idea briefs with blind identity until voting. Wire usage, budgets, timeouts and duplicate-request protection now, not as an afterthought.

Use I1 and I2 from Appendix A for the first human trial. If OpenAI access is missing, deliver the rest and support clearly labelled external imports; do not block the Claude writing experience. Begin decorating with bundled motifs only after text persistence works.

**Exit gate:** Sam can get real ideas, save a single line or a whole seed, reload on another device in a private hosted test when available, and recover the exact saved text. Blind comparison survives refresh. Provider errors never masquerade as writing results. At least one live call per enabled provider is verified within the configured budget; unverified adapters remain labelled unverified.

### Milestone 2 — Song editing and the full test harness

Build song briefs, sections/line IDs, accepted revisions, text locks, selection-based edits, constraint parsing/validation, diff acceptance, conflict recovery, and undo by creating a new revision. Complete task-specific comparisons, the 12-brief fixture pack, repeated runs, votes, outcome metrics and provenance.

**Exit gate:** the “practicing losing” constraints and targeted-edit tests pass; an in-flight suggestion cannot overwrite a newer draft; tests for rhyme uncertainty do not pretend to prove melody fit. Model/effort configuration is recorded and no unsupported parameter is sent. Comparisons use identical frozen context and output counts.

### Milestone 3 — References and sourced craft research

Add optional reference resolution, scoped creative directions inferred from natural language, source-backed technique notes, search/fetch budgets and cached retrieval. Implement unresolved/ambiguous/reference-unavailable states. No genre form is required.

**Exit gate:** a supplied song can be resolved or honestly left unresolved; commentary is linked to evidence; a reference page cannot inject an instruction; a writing request works when research fails. Country feedback does not silently become a global rule for hip-hop/pop.

### Milestone 4 — The illustrated notebook and portability

Finish responsive journal layouts, search/collections/favourites, direct notes/editing, clean reading view, deterministic original motifs, selected-page print output, JSON/asset backup and tested import. Add on-demand image generation only if a separately configured supported provider and spend limit are available. If unavailable, the decorated notebook remains complete and image generation is clearly not enabled.

**Exit gate:** saved writing remains editable/selectable; a long lyric does not clip; print pages are legible; failed artwork never damages text; backup restored into a fresh DB reproduces owned content and relationships. No invisible account or image-service requirement blocks normal use.

### Milestone 5 — Learning, regression checks and private release readiness

Implement feedback/rewrite evidence, candidate preference extraction, scoped active bundles, an inspect/correct/forget page, candidate-versus-baseline experiments, rollback and data deletion. Run recovery, owner isolation, export/restore, spending and browser tests. Add operational documentation, alerts for stuck jobs, backup instructions and a private deployment recipe for web plus worker.

**Exit gate:** all critical acceptance checks pass or are explicitly blocked by a named external dependency; no claim of personal quality improvement without Sam's judgments. A rollout can start with zero active inferred preferences. Provide a final release report and separate later features from defects.

### Later milestones — do not implement prematurely

Voice memos and melody-aware fitting; optional scheduled journal/research batches; dedicated PDF/book generation; semantic retrieval if needed; more providers; advanced candidate diversity strategies; larger evaluation cohorts; and, only with enough lawful labelled data and demonstrated value, model training where supported. Public collaboration and commercial SaaS are separate projects.

## 14. Required acceptance checks

Focus tests on failures that could lose work, mislead Sam or spend money. Do not write brittle tests that just repeat implementation or assert one exact model phrase. Unit tests use deterministic fixtures; provider contract tests are separate and real paid smoke tests are capped. Mark mock/live coverage accurately.

| ID | Scenario | Required result |
| --- | --- | --- |
| A01 | Generate ideas without a project/reference | Valid requested number of title/concept/line cards; no onboarding form required |
| A02 | Generate while no provider is connected | Clear connection state; writing/saving/export still usable; no fake output |
| A03 | Save a seed or one line, then refresh | Exact revision persists; no duplicates on repeated click/retry |
| A04 | Change only “leaving” to “losing” in a selected phrase | Other text stays byte-for-byte unchanged; the app does not rewrite the chorus |
| A05 | Lock first six lines and request a new ending | Only allowed lines can change; a malicious/incorrect provider patch is rejected |
| A06 | Start/end wording constraint | First/last requested wording matches the declared normalisation rule; invalid candidates cannot be accepted as compliant silently |
| A07 | Contradictory constraints | Specific conflict shown; no silent relaxation or endless repair loop |
| A08 | Unknown pronunciation/slant rhyme | Uncertainty is visible where relevant; no false “perfect rhyme” guarantee |
| A09 | Ambiguous song title | User can identify the intended recording; no invented commentary |
| A10 | Unavailable page, missing quote, research timeout | Missing evidence recorded; quote not fabricated; writing continues with accurate provenance |
| A11 | External page contains instructions/localhost URL | No tool-policy override, credential exposure or private-network fetch |
| A12 | Reject surreal line in a country song | Task/scope evidence captured; no universal anti-surreal preference activated |
| A13 | Ignore a card / undo a rejection | Ignore is neutral; reversal updates future learning without double counting |
| A14 | Edit accepted line during a generation | Newer draft survives; stale proposal requires explicit conflict resolution |
| A15 | Two tabs/devices save same base revision | Conflict or safe explicit merge; no last-write-wins loss |
| A16 | Offline draft, refresh, reconnect | Local unsynced text is recoverable and safely reconciled |
| A17 | Double-submit generation / queue redelivery | One logical run and no duplicate committed candidates; uncertain API billing handled honestly |
| A18 | Kill worker after request starts; restart | Recovery does not blindly repay/replay; uncertain run enters reconciliation |
| A19 | One of two providers fails | Successful result retained; comparison not counted as a quality win |
| A20 | Inspect blind UI, network and refresh | A/B mapping/model/cost hidden until reveal; assignment remains stable |
| A21 | Reveal before voting | Trial marked unblinded and excluded from blind preference aggregates |
| A22 | Concurrent jobs approach budget | Atomic reservations enforce configured limits; failed/unknown charges never become zero silently |
| A23 | Provider 401/429/timeout/refusal/truncation | Typed state, bounded safe retries, preserved draft, no silent model substitution |
| A24 | Cancel/delete while model or image runs | No late overwrite/resurrection; costs may be reported if already incurred |
| A25 | Another identity guesses record/run/asset/export IDs | All access denied, including queue/control endpoints and cached responses |
| A26 | Public client bundle/log inspection | No API secrets, DB credentials, private lyric telemetry or service-role keys |
| A27 | Bad schema or invalid edit from model | Boundary validation catches it; bounded repair; never corrupts canonical text |
| A28 | Image provider fails / words edited after illustration | Text/page survives; no automatic regeneration charge |
| A29 | Backup/restore into fresh DB | Text, revisions, links, feedback and assets restored; secrets excluded; duplicate import handled |
| A30 | Malformed import / path traversal / foreign owner IDs | Rejected before partial changes; importing cannot grant access or overwrite unrelated work |
| A31 | Candidate taste bundle worsens results | Baseline can be retained/rolled back; existing songs unchanged |
| A32 | Held-out evaluation data queried by learning worker | Not accessible to candidate creation/retrieval; leakage check fails the build |
| A33 | Mobile Safari: keyboard, selection, scrolling, long title | Composer usable; no clipped lyrics; save/status/feedback accessible |
| A34 | Keyboard and screen reader / print preview | Actions labelled/focusable; text contrast and printed pagination usable |

Automate A03–A07, A12–A15, A17–A32 at the appropriate unit/integration boundary where practical. Use browser tests for the main happy path, auth, persistence, conflicts, blind reveal and mobile layout. Check A33 on a real iPhone when access exists; an emulated viewport is useful but is not a real-device test. Do not block unrelated progress if physical device access is unavailable—record the limitation.

### Operational checks before release

- Clean install, typecheck, lint, targeted tests and production build pass.
- Migrations tested against a fresh DB and a representative prior-version fixture. Back up before destructive changes. Do not edit applied migrations silently; add a migration and recovery notes.
- Simulate process restart, network loss, insufficient API funds and a full daily budget.
- Verify backup restore, private auth, secret configuration, worker health and stuck-job recovery.
- Review dependencies and security-sensitive changes for relevant known issues. No fake assurance of a zero-bug app.
- Keep CI isolated from real unpublished drafts and live API billing. Small live smoke tests run deliberately with spend bounds.

## 15. Data handling and maintenance

Sam's unreleased work is confidential. Explain at setup that selected models receive the text needed for generation. Verify current provider data handling/retention controls; do not promise zero retention or private training arrangements without evidence. Never send the entire journal for a one-line edit. Store minimal relevant context, and keep diagnostic logs content-free by default.

Keep user writing and decision history until explicitly deleted; do not quietly age out unsaved sessions. Provide archive and explicit deletion controls. Routine technical logs can use a short documented retention window, initially 30 days. Backups have a documented retention/expiry policy selected at deployment. Explain that deleting active data cannot instantly remove it from historical backups or undo a provider request already sent.

Deletion must cover stored text, derived search entries/embeddings if any, assets and relevant learned evidence, while preserving only minimal non-content billing/security records when needed. Jobs must see deletion tombstones. Disable or rebuild preferences whose evidence was removed. Do not “forget” in the UI while continuing to inject the same text through a cached prompt bundle.

Use feature flags for unfinished image/audio/scheduled workflows; do not leave buttons that silently do nothing. Monitor job failures, provider latency, schema errors, budget reconciliation and backup success without recording lyrics in third-party analytics. An unobtrusive health view in Settings is enough.

The same model alias may change over time. Record returned model version/snapshot where available, request timestamp, SDK version and exact settings. New model defaults require a fresh comparison. Persist providers as configuration, not scattered hardcoded strings, but do not fetch-and-enable arbitrary new models automatically.

## 16. What to deliver back to Sam

At the end of each milestone, give a concise progress report: what now works, how it was checked, any real blocker, and the next step. Do not drown him in package names.

At release readiness, provide:

1. Runnable source repository with a lockfile, migrations, `.env.example`, scripts and clear local startup instructions.
2. Private deployment instructions for web, worker, DB/auth/storage; selected host and expected baseline costs documented before purchase.
3. A short user guide: ask for ideas, attach a reference, save/develop, make a precise edit, compare models and export.
4. Reproducible 12-brief test pack and exportable real comparison results. Do not invent winners or fill ratings with AI guesses.
5. Test evidence: command results, representative desktop/mobile screenshots, live-versus-mocked integration status and known limitations.
6. Backup/restore, cost-limit, API-key rotation, provider-outage and rollback instructions.
7. A clear “implemented / needs credentials / deferred” checklist against this document. A stub is not a completed feature.

Do not call the app complete merely because it compiles, and do not spend weeks perfecting decoration before Sam has judged a real writing session.

## Appendix A — Initial model-test pack

These are **synthetic evaluation briefs**, not a claim about Sam's finished songs or approval of these placeholder lines. Store them as versioned fixtures. They require no paid lyric database or live search. Use the same optional reference pack on both sides if adding references later.

Start with I1 and I2 for a short idea trial; add E1 when precise editing is implemented. The full development pack has four idea tasks, four contextual-line tasks, and four precise edits. Two generations per configuration gives 24 brief-level trials; run small batches to respect time and budget. Report literal instruction checks separately from creative preferences. This is exploratory evidence, not a scientific songwriting benchmark. Create a separate private holdout set from new briefs before optimising prompts on this pack.

### I1 — Contemporary country, male narrator

“Give me three distinct original song ideas about a man realising too late that repeated small choices cost him a relationship. Each needs a title, a two-sentence concept and three seed lines. He wasn't deliberately trying to end it. Avoid bar, truck and whiskey imagery in this batch. At least one idea should work through an ordinary concrete detail; don't make all three the same song.”

Judge: distinct concepts, credible narrator, natural language, useful title, seed lines that belong to the concept. Validate exactly three ideas and three lines each.

### I2 — Confessional pop/rock, female narrator

“Three ideas from a woman who is furious that her ex is treating someone else better, and embarrassed that she's still checking. Let humour or self-awareness sharpen the hurt. Avoid declaring the new girlfriend an enemy. Title, concept and three lines each. No artist imitation or required rhyme.”

Judge: specificity, emotional contradiction, perspective and fresh execution rather than generic empowerment slogans.

### I3 — Character-led hip-hop

“Three ideas about a narrator who can buy an impressive home but can't make anyone feel at home in it. Allow surreal imagery, humour and vulnerability; don't turn this into a country breakup ballad. Title, concept and three rhythmically interesting seed lines each. No mandatory title pun.”

Judge: character, imagery, rhythmic possibility, genre flexibility and distinct angles.

### I4 — No brief, surprise me

“Give me three song ideas: one intimate, one funny with an uncomfortable truth, and one strange but emotionally clear. Any genre. Each needs a title, concept and three lines. Make the situations different; avoid three breakup songs.”

Judge: range, coherence and whether a seed makes Sam want to write. This tests exploration rather than conformity.

### L1 — Quiet relationship detail

Context: male narrator has mistaken the absence of arguments for improvement; she has stopped expecting him home. Accepted opening: “You got used to leaving lights on / And plates by the stove.” Request: “Give me three alternative two-line continuations. Keep those opening lines untouched. Show his mistaken reading through behaviour; don't explain the entire song or mention Friday.”

Judge: specific detail and delayed recognition. Hard checks: two lines per alternative; accepted opening unchanged; forbidden word respected.

### L2 — Funny, with a cost

Context: a female pop narrator keeps staging photos to look over her ex, then checks whether he saw them. Request: “Give me three alternative couplets that reveal this without using social-media platform names or saying ‘I'm not over you.’ Keep it conversational. The joke should reveal hurt, not just be a caption.”

Judge: singable speech, a real emotional implication and varied approaches. No fixed rhyme.

### L3 — Contradictory host

Context: a character throws extravagant parties but feels relieved and lonely when guests leave. Request: “Three alternative four-line passages with room for internal rhyme. Include one physical action that exposes the contradiction. No generic ‘crowded room but alone’ wording. Don't resolve the conflict for him.”

Judge: character consistency, rhythmic opportunity and imagery. Validate four lines, not a whole verse plus commentary.

### L4 — Ending phrase

Context: a country narrator thinks absence has no cost until his partner stops waiting. Request: “Three alternative two-line chorus endings. Each must end with the exact words ‘losing you’. The first line should set that phrase up meaningfully. A natural slant rhyme is welcome; don't force one. No leaving or breathing.”

Judge: setup/payoff, meaning and natural phrasing. Hard checks: final phrase and forbidden tokens. Do not treat spelling as rhyme evidence.

### E1 — The smallest possible edit

Fixture: “I kept coming home\nLike that was the same as staying\nYou were learning to let go\nI was practicing leaving”. Request: “Change only the final word from leaving to losing. Keep everything else exactly the same.”

Expected structural result: exactly one token replacement; all other characters/line breaks unchanged. This is an instruction-following check, not a creative taste ranking. It must not generate a full new chorus or force a rhyme.

### E2 — Explicit start and end

Synthetic fixture: “I was practicing leaving\nOne Friday at a time\nI kept saying we were fine\nLike saying made it true”. Request: “Keep the middle two lines exact. The first line must become ‘I was practicing losing’. Give three options for the last line, each ending ‘losing you’. He is realising what his behaviour meant, not admitting an intention to break up.”

Validate first line, locked middle lines and final phrase. Judge the last line's meaning and fit. The fixture is not a proposed final chorus and approximate rhythm judgments need human review.

### E3 — Exact change in repeated sections

Fixture contains two pre-choruses, each “Quit getting mad\nI should've been scared of that”, plus a verse containing the unrelated line “I quit calling after midnight”. Request: “In both pre-choruses change ‘Quit getting mad’ to ‘You stopped getting mad’. Don't change any other use of quit or any other lyric.”

Validate both scoped replacements and preservation of the verse. This catches global string-replacement bugs and repeated-section identity problems.

### E4 — Rhyme retained without the repeated word

Synthetic bridge: “I watched the headlights leaving\nAnd told myself I'm dreaming”. Request: “Give three replacements for only the first line. Remove ‘leaving’ while keeping a natural sung rhyme or slant rhyme with ‘dreaming’. Keep the sense of watching her drive away and approximately the same rhythm. Leave the second line exact. Avoid wording that only exists to make the rhyme.”

Validate selection/forbidden word/locked second line. Let Sam judge phonetic and musical fit; report a slant rhyme honestly. Preserve rejected candidates for comparison without mistaking them for accepted lyrics.

## Appendix B — Requirement traceability

| Sam's request | Where this plan handles it |
| --- | --- |
| Titles, meanings and lines without an existing song | Sections 2–4; idea cards and Journal |
| Help with an existing lyric and specified rhymes/rhythm | Sections 4, 11–12; E1–E4 and A04–A08 |
| Research successful songs and actual songwriter commentary | Section 6; source records and A09–A11 |
| Improve from what he likes and rewrites | Section 7; evidence, scoped preferences, evaluations and rollback |
| Test models first, switch or run them simultaneously | Section 8; milestone 1, bounded parallel trials and Appendix A |
| Prefer significantly cheaper models if quality is close | Section 8; useful/exceptional results and attributed cost |
| Build in Claude Code using his Max account where applicable | Sections 1 and 8; subscription/API distinction and actual-account verification |
| Try Astra at higher effort | Section 8; separate provider/model/effort configurations |
| Illustrated journal of song seeds | Sections 3 and 9; milestone 4 with functional bundled artwork |
| Different artist/genre directions without a complex app | Sections 3 and 5; natural-language direction and scoped taste |
| Type a song reference for each request, optionally | Section 5; optional reference chip with verification and correction |
| Avoid a million settings | Section 3; Write/Journal only; progressive disclosure |
| Few bugs and easy maintenance | Sections 10–16; immutable revisions, contracts, recovery, budgets and targeted tests |
| Keep ownership of his judgment/data and change providers later | Sections 7–10 and 15; provider adapters and tested portable export |

## Appendix C — Official implementation references

Retrieved/checked 8 October 2026 in Los Angeles. These establish current integration facts, not an endorsement of any model's lyrical quality. Recheck at build time. Pricing, availability, credits and SDK parameters can change. The architectural and evaluation recommendations in this handoff are design proposals.

- **[S1] OpenAI, GPT-6 Astra model:** https://developers.openai.com/api/docs/models/gpt-6-astra — ID, reasoning-effort options and base pricing.
- **[S2] Anthropic, Models overview:** https://platform.claude.com/docs/en/models/overview — current Claude IDs, base pricing and documented defaults.
- **[S3] Anthropic, Monthly API credits for Max and Team plans:** https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-and-team-plans — credit amounts, eligibility, account linking and separate allowance.
- **[S4] Anthropic, Use Claude Code with your Pro or Max plan:** https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan — subscription login and API-key billing behaviour.
- **[S5] Anthropic, Opus 5.5 migration guide:** https://platform.claude.com/docs/en/models/opus-5-5/migration-guide — adaptive thinking, output budgets and model-specific request compatibility. Also see https://platform.claude.com/docs/en/build-with-claude/effort.
- **[S6] pg-boss official repository/README:** https://github.com/timgit/pg-boss/blob/master/README.md — Node/Postgres durable job queue. Inspect the installed version's documentation and deployment constraints.
- **[S7] Supabase, Server-Side Rendering:** https://supabase.com/docs/guides/auth/server-side — current server authentication patterns.
- **[S8] Supabase, Row Level Security:** https://supabase.com/docs/guides/database/postgres/row-level-security — grants, ownership policies, exposed schemas and privileged-role caveats.

[S1]: https://developers.openai.com/api/docs/models/gpt-6-astra
[S2]: https://platform.claude.com/docs/en/models/overview
[S3]: https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-and-team-plans
[S4]: https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan
[S5]: https://platform.claude.com/docs/en/models/opus-5-5/migration-guide
[S6]: https://github.com/timgit/pg-boss/blob/master/README.md
[S7]: https://supabase.com/docs/guides/auth/server-side
[S8]: https://supabase.com/docs/guides/database/postgres/row-level-security

## Start here, Claude Code

Read this document in full and inspect the working directory. Create your tracked milestone checklist and record any justified changes to the recommended architecture. Begin milestone 0, then implement the usable milestone 1 writing/journal/model-comparison path before expanding. Continue through the first-release milestones while respecting dependency gates. Keep the interface to Write and Journal. Preserve all drafts and revisions. Ask me only for actual blockers, credentials, paid commitments or destructive actions; choose reversible defaults for routine details. Never claim a mocked integration is live, a small sample proves lyrical superiority, or a stored preference is model retraining. At each milestone tell me what I can now do, how you verified it and what comes next.
