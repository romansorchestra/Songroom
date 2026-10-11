# Songroom — approved design and implementation specification

10 October 2026 · Design handoff for the existing app · Owner: Sam

## 1. Read this first

Implement the design described here in the existing Songroom app. Inspect the current implementation before changing it. Preserve user writing, stored ideas, fragments, references, preferences and revision history. This is a precise design and behaviour brief, not authorisation to rebuild the app or migrate its infrastructure.

Sam approved the latest interactive springboard mockup: “everything else is great,” with one exception: he dislikes the salmon colour. Keep the composition, typography, paper strips, warmth and interaction model. Do not interpret this as permission to propose another visual direction.

**Approved:** the expressive Cut & Paste layout, warm paper/forest-ink foundation, coordinated colour variation across ideas, and an idea-generating home screen where Sam adds fragments before saving or starting a song.

**Implementation choice in this handoff:** replace salmon/peach with muted ochre; use sage and muted blue for other idea palettes. The exact replacement palette is a proposed execution detail, not a claim that Sam already saw or approved those swatches. Make palette changes through tokens so they are easy to adjust.

The complete source of the approved interactive mockup is included in Appendix A, with the colour substitutions applied. Render it as the visual reference. It is a demo, not production application code. Its sample ideas, memory-only persistence and simplified interactions must not be mistaken for completed functionality.

## 2. Document authority and resolved conflicts

Use this order when requirements overlap:

1. Sam's latest explicit instruction.
2. This document: visual treatment, navigation, screen hierarchy, one-at-a-time interaction and acceptance criteria.
3. `Songroom_App_Changes_v2.md`: remaining functional fixes, reference handling, context management, precise edits and text protection.
4. `Songroom_Songwriting_Research_Prompt.md`: separate research assignment and research integration requirements.
5. `Songroom_Claude_Code_Handoff.md`: historical background only; do not reintroduce superseded architecture or UI proposals.

| Earlier proposal | Resolved instruction |
| --- | --- |
| Three idea cards on the default home screen | One focused idea at a time; title, concept and seed lines |
| Three/four alternatives simultaneously | One suggestion at a time by default, with previous/next |
| Try previews a suggestion inside the current lyric | Browsing never changes the current lyric; show a separate proposed replacement and apply only on Keep |
| Journal style still open | Expressive paper collage approved; warm paper, forest ink, controlled colour variation |
| Salmon/peach highlight strips | Remove; use the replacement tokens below |
| Main screen primarily edits a song | Write opens the idea springboard; an existing song opens its writing workspace |
| Research prompt says show three/four suggestions | Internal candidate generation may be batched; the UI shows one at a time |
| Need more competing design prototypes | Implement this approved direction; validate fidelity rather than restarting design exploration |

Do not discard useful requirements in the earlier change brief simply because its design proposals have changed. Research and design are separate workstreams; the research collection is not a prerequisite for rendering and testing this interface.

## 3. Product purpose and main destinations

Songroom should feel like a creative notebook that offers a useful starting point. It must be quick enough for a professional co-writing session and inviting enough to browse when Sam is not writing anything specific.

Only two primary destinations: **Write** and **Journal**. Keep settings, model selection, research management and exports in a quiet secondary menu. No third major navigation destination for research, analytics, taste, models or an account dashboard.

Write has two contextual screens: the idea springboard and the song workspace. Starting or opening a song establishes the latter; do not force a mode questionnaire. Journal collects deliberately saved ideas, independent fragments and songs. Recoverable unsaved work belongs in recent activity, visibly distinct from deliberately saved entries.

Do not add an infinite conversation transcript to either writing surface. Instructions, previous ideas and previous suggestions remain available without accumulating down the page.

## 4. Visual system: reproduce the chosen treatment

### Overall character

Warm cream paper; deep forest type; large editorial serif titles on slightly rotated scraps; a small amount of handwritten annotation; a restrained coloured paper strip; discreet controls. The writing is the visual subject. Decoration supports it.

Avoid generic SaaS cards, giant dashboards, neon gradients, glass effects, rounded pills everywhere, prominent purple AI branding, cartoon stationery and ornate leather-book textures. Do not turn the whole app into handwriting. Do not put text into raster images.

### Foundation tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| paper | `#F6F1E6` | `#272A24` | Main app surface |
| ink | `#293D32` | `#ECEBDD` | Primary text |
| secondaryText | `#686B5E` | `#BFC3B2` | Supporting labels |
| edge | `#D9D2C3` | `#4B5146` | Dividers, subtle paper dots |
| sheet | `#FFFCF3` | `#363D31` | White-paper scraps, editor |
| primaryFill | `#2D4435` | `#DAE6C9` | Primary action |
| primaryText | `#FFFAF0` | `#29382B` | Text on primary action |
| paperShadow | `#43382516` | `#00000029` | Very light offset paper shadow |

### Idea-specific palettes

| Palette ID | Light highlight | Light accent text | Dark highlight | Dark accent text |
| --- | --- | --- | --- | --- |
| ochre | `#E2CEA0` | `#71541D` | `#54492E` | `#E1C77F` |
| sage | `#CBD3AF` | `#50633B` | `#455039` | `#C6D7A1` |
| blue | `#BFD0D6` | `#375C6A` | `#344A52` | `#AFCED8` |

Use ochre for the first page. Palette variation affects the highlighted title scrap, paper tape, selected fragment scraps and handwritten annotations. It does not recolour every UI element. Primary actions and app navigation retain the forest foundation.

Do not use salmon, peach, coral or pinkish substitutes. Remove the demo's original `#E8BBA0` salmon and its peach-related text accents. The blue replacement also avoids making the old rose palette feel like another version of the rejected colour.

Assign and persist a palette ID once per idea. Reopening, refreshing, changing tabs or opening the associated song must not reshuffle it. Palette choice is decorative, not a genre classification, quality rating or emotional diagnosis. Do not infer “sad ideas are blue” or map artists permanently to colours.

Validate contrast in the actual rendered UI. Use primary ink on highlighted paper; do not assume any accent colour can serve as small text on any background. Meet 4.5:1 for normal text and 3:1 for large text and essential control boundaries.

### Typography

| Role | Font | Starting size / line height | Treatment |
| --- | --- | --- | --- |
| Brand | DM Serif Display | 26px / 1.2 | `songroom.` lower-case |
| Main idea title | DM Serif Display | 43px / 1.08 | 400; letter spacing -1.3px |
| Narrow-screen title | DM Serif Display | 38px / 1.08 | At widths below 360px |
| Concept/body | DM Sans | 14px / 1.6 | Plain, readable prose |
| Seed lines | DM Serif Display | 22px / 1.4 | Preserve lyric line breaks |
| Handwritten note | Caveat | 24px / 1.2 | Occasional annotation only |
| Fragment display | Caveat | 23px / 1.2 | Short scraps only |
| Input/editor | DM Sans | 16–17px / 1.7 | Unrotated; native selection |
| Utility label | DM Sans | 11–12px / 1.5 | 11px only for short nonessential labels |
| Buttons/nav | DM Sans | 13–14px / 1.5 | Visible labels, comfortable targets |

Use normal and medium weights. Titles and handwritten fragments are selectable text. Bundle the fonts if the existing app's build supports it; retain serif/sans-serif/cursive fallbacks. A failed font load must not hide words or controls. Long titles wrap rather than shrinking into unreadable type.

### Paper treatment and geometry

Use the mockup's composition as the baseline: header padding 18px vertically / 22px horizontally; main area padding 24px top / 26px sides; 8px action gaps; 7px button corners; fine structural dividers.

The desktop preview's rounded 22px exterior and 450px maximum width depict a contained phone view. Do not ship a fake phone frame inside the actual phone viewport. On mobile, fill available width and account for safe areas. On desktop, retain a focused central writing column of roughly 450–560px rather than stretching lyrics across the browser. A quiet surrounding workspace is acceptable; no invented dashboard fills the space.

The app's paper dots are very subtle: approximately 0.6px dots on a 12px grid. The separate dotted preview background outside the phone is presentation scaffolding, not a required part of the production app.

Title: two or more natural phrase chunks when useful. First strip about -2 degrees; highlighted ending about +1 degree and italic. Use 4px vertical / 12px horizontal strip padding. Do not mechanically cut every title into two equal halves. One short title may use one highlighted strip. Display wrapping does not insert unintended line breaks into the stored title.

Seed scrap: near-white paper, 16px / 18px padding, approximately -1 degree rotation. Tape detail roughly 66px by 17px, near the upper middle. Offset shadow about 2px by 4px; no glossy effects. Keep tape clear of actual text.

Fragments: alternating near-white and the idea highlight, slight rotations between -1 and +1 degrees. Keep controls horizontal and easy to hit; do not rotate active inputs or selection surfaces. Long fragments switch to comfortable sans-serif reading rather than a huge handwritten paragraph.

No perpetual animation, fluttering scraps, typewriter streaming across the title or randomly changing positions. Respect reduced motion. Stable reading and touch targets matter more than decoration.

## 5. Home screen: the idea springboard

### Screen order

1. Header: songroom. left, Write / Journal right.
2. A compact optional direction summary, only when a direction has been supplied.
3. Eyebrow “A place to start” and a quiet idea number.
4. Dominant title on paper strips.
5. Concept in one or two sentences; default maximum roughly 45 words.
6. One seed scrap labelled “A first thread,” normally two to four lyric lines.
7. Handwritten prompt: “What does this make you think of?”
8. User fragments attached to this idea.
9. Fragment composer: “A phrase, a memory, half a line…” with Add.
10. Save idea and Start writing.
11. Quiet save/error status.
12. Previous and Another idea in the footer.

Do not show a justification of why the idea is clever. Do not produce an unsolicited complete song. A concept may be an emotional stance or a hook, not necessarily a plotted story.

### Empty and returning states

On a fresh account show a short invitation to generate or paste a starting point, with an optional direction/reference field. Do not require genre, artist, topic, mood, tempo and rhyme fields before the first idea. A user-triggered Generate action starts the first paid request; merely refreshing should not trigger new generation.

On return, restore the last springboard idea with its pending input and fragments. Do not force the existing song editor as the universal home screen. An explicit song link, Journal song entry or resume-song action opens that song directly.

### Direction without option overload

Use one optional compact “Direction / reference” affordance. Expanded, it accepts a free-text brief, artist, song title/link or pasted reference text. A short collapsed summary might read “Modern pop · sharp and conversational.” Clear and edit are available without a permanent bank of controls.

This field steers future generation; it must not retroactively rewrite the current idea. User corrections to reference identity discard the wrong interpretation. Do not assume access to song audio or lyrics from a link alone. Research failure leaves manual direction entry usable.

Typing a fragment and asking AI to develop it are distinct. The fragment composer saves Sam's own words; it must not silently turn them into a prompt or replace them with polished AI prose. An optional “Develop this” action can expose a short instruction field for a particular seed or fragment, with the result shown as a separate proposal.

## 6. Precise springboard interactions

| Action | Required result | Must preserve |
| --- | --- | --- |
| Add fragment | Attach exactly what Sam typed to current idea | Existing fragments, seed, title, draft input until stored |
| Save on fragment | Save that fragment independently to Journal; show Saved | Parent link and original text; no forced whole-idea save |
| Save idea | Deliberately collect current idea with associated fragments | Identities; no duplicate entries on repeated tap |
| Start writing | Create/open linked song, carry seed and fragments as reference material | Current idea and all fragment text |
| Another idea | Generate a new idea using current direction | Current idea in recoverable recent history |
| Previous | Restore previous idea and its exact working state | Palette, fragments, pending composer, linked song |
| Journal | Open collection; return to work without losing state | Current selection and pending input |

Save idea marks the idea as collected; it does not automatically turn every attached fragment into a separately saved Journal entry. A fragment saved independently can still appear within its source idea. Store that relationship rather than creating divergent copies.

Preserve user-entered spaces and lyric line breaks. A single-line field may expand into a multiline composer when needed. Enter and modifier handling must suit mobile keyboards; a visible Add action always remains available. Reject empty submissions without clearing nonempty input. Do not impose the demo's arbitrary 400-character cap if the actual app supports more.

Automatic draft persistence protects work; explicit Save means intentional collection. Show truthful “Saving,” “Saved” and failure states. If persistence fails, keep the text locally available and expose Retry; do not display a false success checkmark. Do not show repeated modal save confirmations.

Another idea replaces the active presentation, not the history. Rapid double taps must not send duplicate paid requests. While generating, retain the prior idea and its working text, show a small pending state, and disable duplicate submission. Failure leaves the old idea usable. A late response belongs to the request that produced it; it cannot overwrite a different active idea.

Previous and forward recovery must work by stable IDs. Do not use the demo's circular three-item fixture carousel as real generation/history behaviour. A compact Recent menu may recover older unsaved work, with an explicit retention policy if history is limited.

## 7. Start writing and the song workspace

Starting a song creates an actual persistent draft once, linked to its idea. Repeated taps open the same draft. Its initial title comes from the idea, but later song-title changes need not rewrite the original seed idea.

The song workspace retains the approved paper/typography family. Accepted lyrics use a stable, unrotated editable sheet. Source seed lines and fragments appear in a separate shelf labelled “Starting points” or “Scraps.” They are not accepted lyrics until explicitly inserted. On a fresh song the lyric sheet may be empty; the source material remains immediately available.

Do not fill the song with generated verses merely because Sam pressed Start writing. “Add to lyrics” explicitly inserts the chosen seed or fragment at the active insertion point, with a recoverable revision. Preserve the source fragment. Make subsequent repeated insertion intentional rather than the result of double taps.

### Suggestions while working on lyrics

Select a word, phrase or line, then give a short instruction. Show **one suggestion at a time**, with Previous / Another and Keep. A discreet Save fragment action preserves an alternative without accepting it.

Keep the selected original line and limited surrounding context visible. The proposed replacement can appear in its own paper strip with changed words emphasised. Browsing, selecting or moving between alternatives never mutates the accepted lyric sheet, even temporarily. Only Keep applies the replacement.

A compact expandable constraint row may show rhyme target, rhythm reference and current meaning when relevant. Do not require fields on every request. “Keep the rhythm,” “rhyme with losing” or “only change this word” should carry forward through More until changed.

Application code enforces edit boundaries. The model proposes a replacement span; the app reconstructs the original text around it. Reject edits that touch locked text or were generated against a stale revision. A preference learned from prior writing never overrides the selected scope. Keep previous revisions and Undo.

The real app must not claim to know a melody from text alone. A typed rhythmic sample is a reference; syllable checks are assistance, not proof of sung fit. Preserve literal spelling, punctuation and newlines outside the edit scope.

## 8. Journal

Use the same warm notebook family. This is the collection, not a second chat feed. A saved idea entry foregrounds its title and a useful line. A saved fragment foregrounds the actual fragment, with a quiet parent-idea link. A song entry opens the song workspace directly, not a detour through its original idea.

A compact All / Ideas / Fragments / Songs filter and search are appropriate as the collection grows; avoid tag-entry requirements. Use semantic content labels as well as colour. Palette, title and source relationships remain stable when an item is reopened.

Opening an idea reveals its concept, seed lines and attached scraps in the same composition as the springboard. Journal must not require a finished title or concept to save a fragment. Exported/clean reading text preserves exact line breaks; decoration is a presentation layer over editable text.

No generated illustration service is required for this iteration. The paper collage supplies character. Optional original motifs can be added sparingly later, without crowding words or delaying core flows.

## 9. Responsive, accessible and honest states

Validate at 320, 390/393, 430, 768 and 1440px widths. On a phone, use the available screen width rather than a nested narrow device frame. No horizontal clipping from rotated strips. Very long titles, unicode, apostrophes and multiline fragments must wrap.

The page scrolls naturally; avoid multiple nested scrolling panes. With the mobile keyboard open, the active composer and submission control must remain reachable. Do not use a fixed footer that covers the last line. Preserve cursor and selection during streaming, autosave and navigation.

All actions use native buttons; edit fields have accessible labels. Tap targets are at least approximately 44px. Visible focus, keyboard operation and meaningful screen-reader names are required. Do not use an icon without a label/name. Announce concise save/errors, not every streaming token.

Use a small calm loading treatment; render structured content when usable rather than allowing every token to rearrange the paper collage. If a response is malformed, show a retry state and preserve the previous good result. Never present fixture content as a live model response. If the provider is not configured, say so clearly.

Dark mode uses the specified dark tokens and keeps the same hierarchy. Do not turn it into a pure-black neon interface. Do not add an unsolicited palette picker; idea variation is automatic and stable.

## 10. Implementation boundaries that prevent bugs

Retain the current framework, database and provider integrations where practical. Do not copy the demo's innerHTML rerendering into a production text editor: rerendering must not lose focus, cursor, selection or unsaved composer input. Escape untrusted text and keep it as text, never executable markup.

Map the following concepts into the existing schema rather than introducing a new architecture: idea ID and palette ID; fragment ID with source relationship and independently saved status; linked song ID; accepted lyric revision; current selection; suggestion ID tied to revision/constraints; pending composer text; persisted save state.

Draft protection and deliberate collection are different state properties. Navigation state is also separate from generation state. Do not infer “saved” merely because something is currently visible. Never use array position as record identity.

Keep exact-edit validation, persistence and request deduplication as application logic. Visual snapshots cannot prove these behaviours. Preserve existing authentication, server-side credentials, backups and reasonable spend protections. Do not introduce elaborate new services solely for this redesign.

## 11. Implementation sequence and review gates

1. Inspect current app and stored records. Identify existing routes/components and the narrowest safe change. Record any current unimplemented dependencies honestly.
2. Render Appendix A as a reference. Implement the foundation tokens and springboard component with explicitly labelled fixture data. Keep the approved proportions and font roles.
3. Produce phone and desktop screenshots. Compare against the reference before connecting generation. Correct font, spacing, title strips, paper colours and hierarchy; do not ask Sam to choose another direction.
4. Connect existing idea generation, draft persistence, saved fragments and linked songs. Add stable per-idea palette IDs. Replace fixture controls with real request/history behaviour.
5. Implement the one-suggestion workflow and explicit Keep behaviour in the existing song editor. Preserve narrow edit enforcement and locked text.
6. Integrate Journal navigation and independent fragment records. Confirm existing saved material remains accessible.
7. Run the targeted checks below and a short realistic phone session. Stop expanding scope once these behaviours and visual fidelity are established.

Do not report the redesign complete while the screenshots still show the old default card/chat layout. Do not report writing quality improved just because the UI changed. Report visual/functional validation separately from creative-quality evaluation.

## 12. Acceptance checklist

### Visual fidelity

- [ ] Large serif title appears on slightly rotated paper strips; final phrase uses the current highlight.
- [ ] Warm cream and forest foundation matches the supplied tokens.
- [ ] No salmon, peach, coral or pink substitute remains in the new UI.
- [ ] At least three coordinated palettes work; the same idea always reopens with its original palette.
- [ ] Concept is short body text; seed lines occupy a taped paper scrap; fragments feel like handwritten notes.
- [ ] Primary controls remain restrained, with one clear Start writing action.
- [ ] Mobile, desktop, dark mode and long content remain readable without clipped strips or hidden controls.

### Behaviour and preservation

- [ ] First generation works with no mandatory questionnaire.
- [ ] Add fragment stores exact text without invoking an unsolicited rewrite.
- [ ] Saving a fragment independently does not require saving the whole idea.
- [ ] Repeated Save does not duplicate entries.
- [ ] Another idea and Previous preserve both added fragments and unsubmitted composer input.
- [ ] Reload restores persisted work; a failed save never reports success.
- [ ] Start writing creates one linked draft and keeps source material separate from accepted lyrics.
- [ ] Journal song entries open the correct song workspace.
- [ ] Browsing suggestions leaves the lyric byte-for-byte unchanged.
- [ ] Keep modifies only the authorised span; locked text and surrounding punctuation/newlines remain intact.
- [ ] Stale responses cannot overwrite newer edits or another idea.
- [ ] Provider errors preserve the last useful content; fixtures cannot appear as real generation.
- [ ] Mobile keyboard use, selection and cursor position remain stable during autosave.

Automate the high-risk text/persistence checks. Verify layout with screenshots and actual interaction at the listed sizes. If a test cannot be run, state that limitation; do not substitute “looks fine” for a completed test.

## 13. How Sam should hand this to Claude

Keep one app-building task/conversation focused on the existing app. Supply this file plus `Songroom_App_Changes_v2.md` and access to the actual project. This document wins on design and the explicitly resolved conflicts. The original long handoff is optional historical reference, not a second active spec.

Run the songwriting research as a separate task/conversation using `Songroom_Songwriting_Research_Prompt.md`. Give it this latest UI constraint: user-facing suggestions are one at a time. Return its finished source index, craft records, examples and integration notes to the builder. The research prompt alone is an assignment, not a researched knowledge base.

The two tasks can share a project folder, but should write to distinct areas: the builder owns application files; research owns research outputs. Avoid two sessions simultaneously modifying app source, migrations or the same prompt files. Integrate research through the builder after reviewing the pilot, without holding the visual redesign hostage to the full collection.

These are task-organisation instructions; they do not assume a particular Claude subscription includes model API usage or that Cowork automatically has repository, browser or deployment access. Use the environment that can actually inspect, edit and test the existing app.

### Paste this into the building task

> Read `Songroom_Approved_Design_Build_Spec.md` first and treat it as the authoritative design and interaction specification. Read `Songroom_App_Changes_v2.md` for the remaining functional requirements; its superseded UI proposals are explicitly resolved in the new document. Inspect the existing project and preserve all current writing and records. Render the included reference source, then implement that design faithfully with the new no-salmon palettes. Do not redesign it, rebuild the stack, or turn it into a generic chat/dashboard. The home screen is a one-idea springboard; fragments can be saved independently; Start writing carries source material without silently accepting it into lyrics. Song suggestions appear one at a time and change lyrics only on Keep. Work through the implementation sequence, verify with phone/desktop screenshots and the targeted acceptance checks, and report what is complete, tested and still blocked. Research is a separate workstream; do not wait for it to make the design usable.

## Appendix A. Executable visual reference

The following HTML fragment is self-contained except for its font stylesheet. For standalone inspection, place it in a normal HTML document with a viewport meta tag and `color-scheme: light dark`. Its outer dotted preview wrapper can be omitted. The production app should use its own component structure and real data; the fixture interactions below are only an inspectable design reference.

The fragment deliberately contains only three sample ideas. It does not call a model, persist after refresh, implement full reference entry, or enforce production lyric edit boundaries. Do not copy those limitations. Its basic draft editor illustrates the transition; Sections 7–12 define the actual editing requirements.

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=DM+Serif+Display:ital@0;1&family=Caveat:wght@400;500&display=swap">
<div class="viz-dotted-background" style="padding:18px 8px"><div id="sr-spring">
<style>
#sr-spring{--paper:light-dark(#f6f1e6,#272a24);--ink:light-dark(#293d32,#ecebdd);--sub:light-dark(#686b5e,#bfc3b2);--edge:light-dark(#d9d2c3,#4b5146);--sheet:light-dark(#fffcf3,#363d31);--accent:light-dark(#71541d,#e1c77f);--tint:light-dark(#e2cea0,#54492e);--solid:light-dark(#2d4435,#dae6c9);--on:light-dark(#fffaf0,#29382b);--shadow:light-dark(#43382516,#00000029);font-family:'DM Sans',sans-serif;font-size:14px;line-height:1.5;color:var(--ink);background:var(--paper);max-width:450px;margin:auto;border:1px solid var(--edge);border-radius:22px;overflow:hidden}
#sr-spring *{box-sizing:border-box}#sr-spring button,#sr-spring input,#sr-spring textarea{font:inherit}#sr-spring button{color:inherit;border:0;background:none;min-height:44px;padding:8px 12px}#sr-spring button:disabled{opacity:.35}#sr-spring header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--edge)}#sr-spring .brand{font-family:'DM Serif Display',serif;font-size:26px;letter-spacing:-1px}#sr-spring nav{display:flex;gap:4px}#sr-spring nav button{font-size:13px;color:var(--sub)}#sr-spring nav button.active{color:var(--ink);text-decoration:underline;text-underline-offset:7px}#sr-spring main{padding:24px 26px 18px;background-image:radial-gradient(var(--edge) .6px,transparent .6px);background-size:12px 12px}#sr-spring .eyebrow{font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:var(--sub)}#sr-spring .topline{display:flex;justify-content:space-between;align-items:center}#sr-spring .serial{font-family:'Caveat',cursive;font-size:22px;color:var(--accent)}#sr-spring h1{font-family:'DM Serif Display',serif;font-weight:400;font-size:43px;line-height:1.08;letter-spacing:-1.3px;margin:25px 0 22px}#sr-spring .title-strip{display:table;background:var(--sheet);box-shadow:2px 4px 0 var(--shadow);padding:4px 12px;transform:rotate(-2deg);max-width:100%}#sr-spring .title-strip:last-child{transform:rotate(1deg);background:var(--tint);margin-top:3px;font-style:italic}#sr-spring .concept{max-width:340px;margin:0 0 25px;line-height:1.6}#sr-spring .seed{padding:16px 18px;background:var(--sheet);box-shadow:2px 4px 0 var(--shadow);transform:rotate(-1deg);position:relative;margin:8px 3px 28px}#sr-spring .seed:before{content:'';position:absolute;width:66px;height:17px;background:var(--tint);top:-9px;left:40%;transform:rotate(4deg)}#sr-spring .lines{font-family:'DM Serif Display',serif;font-size:22px;line-height:1.4;white-space:pre-line;margin:8px 0}#sr-spring .hand{font-family:'Caveat',cursive;font-size:24px;color:var(--accent);margin:0 0 9px;transform:rotate(-2deg)}#sr-spring .fragment{background:var(--tint);padding:10px 12px;margin:10px 0;display:flex;align-items:center;gap:8px;transform:rotate(1deg)}#sr-spring .fragment:nth-child(even){transform:rotate(-1deg);background:var(--sheet)}#sr-spring .fragment p{font-family:'Caveat',cursive;font-size:23px;line-height:1.15;margin:0;flex:1;overflow-wrap:anywhere}#sr-spring .fragment button{font-size:12px;padding:6px;flex-shrink:0}#sr-spring form{display:flex;gap:6px;border-bottom:1px solid var(--ink);margin:18px 0 22px}#sr-spring input{min-width:0;flex:1;border:none;background:transparent;color:var(--ink);font-size:16px;padding:10px 0}#sr-spring input::placeholder,#sr-spring textarea::placeholder{color:var(--sub)}#sr-spring .actions{display:flex;gap:8px}#sr-spring .primary{background:var(--solid);color:var(--on);border-radius:7px;flex:1}#sr-spring .secondary{border:1px solid var(--edge);background:var(--sheet);border-radius:7px;flex:1}#sr-spring .pager{display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--edge);padding:9px 16px}#sr-spring .pager button:last-child{color:var(--accent)}#sr-spring .status{font-size:12px;color:var(--sub);min-height:22px;margin-top:12px}#sr-spring .demo{font-size:11px;text-align:center;padding:8px;color:var(--sub)}#sr-spring textarea{width:100%;min-height:190px;resize:vertical;background:var(--sheet);border:1px solid var(--edge);border-radius:5px;color:var(--ink);padding:16px;font-size:17px;line-height:1.7;margin:12px 0}#sr-spring .journal-entry{display:block;text-align:left;width:100%;background:var(--sheet);border-bottom:1px solid var(--edge);margin:12px 0;padding:16px}#sr-spring .journal-entry strong{font-family:'DM Serif Display',serif;font-size:23px;font-weight:400;display:block}#sr-spring .journal-entry small{color:var(--sub)}#sr-spring [hidden]{display:none!important}@media(max-width:360px){#sr-spring main{padding:22px 19px 16px}#sr-spring h1{font-size:38px}#sr-spring header{padding:14px 17px}}
</style>
<header><span class="brand">songroom.</span><nav aria-label="Main"><button class="cursor-interaction active" data-nav="ideas">Write</button><button class="cursor-interaction" data-nav="journal">Journal</button></nav></header>
<main id="sr-content"></main>
<div class="pager" id="sr-pager"><button id="sr-prev" class="cursor-interaction">← Previous</button><button id="sr-next" class="cursor-interaction">Another idea ↗</button></div>
<div class="demo">Interactive design preview · sample ideas</div>
<script>
(()=>{
const root=document.getElementById('sr-spring'),content=root.querySelector('#sr-content');
const ideas=[{title:['When your','friends go home'],concept:'You only want me when there’s nobody else around. I’m starting to know the difference between being missed and being convenient.',lines:'You want me back\nwhen your friends go home.',fragments:[{text:'am I your person or just who’s awake?',saved:false}],color:['#e2cea0','#54492e','#71541d','#e1c77f']},{title:['Still know','the code'],concept:'I could still let myself into your apartment. The strange part is knowing I’m no longer someone who should.',lines:'I still know the code to your front door.\nI just don’t know what I’d come in for.',fragments:[],color:['#cbd3af','#455039','#50633b','#c6d7a1']},{title:['Good on','paper'],concept:'Everyone says we make sense. I keep trying to feel something that’s so easy to explain.',lines:'You’re everything I said I wanted.\nI wish I’d known myself back then.',fragments:[],color:['#bfd0d6','#344a52','#375c6a','#afced8']}];
let index=0,view='ideas';const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function status(s){const el=root.querySelector('#sr-status');if(el)el.textContent=s;}
function fragments(d){return d.fragments.map((f,i)=>`<div class="fragment"><p>${esc(f.text)}</p><button class="cursor-interaction" data-save-fragment="${i}" aria-label="${f.saved?'Fragment saved':'Save fragment'}">${f.saved?'Saved ✓':'Save ↗'}</button></div>`).join('');}
function render(){const d=ideas[index];root.style.setProperty('--tint',`light-dark(${d.color[0]},${d.color[1]})`);root.style.setProperty('--accent',`light-dark(${d.color[2]},${d.color[3]})`);root.querySelector('#sr-pager').hidden=view!=='ideas';root.querySelector('#sr-prev').disabled=index===0;root.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===(view==='journal'?'journal':'ideas')));
if(view==='journal'){const entries=[];ideas.forEach((a,i)=>{if(a.saved||a.draft!==undefined)entries.push(`<button class="journal-entry cursor-interaction" data-open="${i}"><small>${a.draft!==undefined?'Song in progress':'Idea'}</small><strong>${esc(a.title.join(' '))}</strong></button>`);a.fragments.forEach(f=>{if(f.saved)entries.push(`<button class="journal-entry cursor-interaction" data-open="${i}"><small>Fragment · ${esc(a.title.join(' '))}</small><strong>${esc(f.text)}</strong></button>`);});});content.innerHTML=`<div class="eyebrow">Keep the sparks</div><h1>Your journal.</h1>${entries.join('')||'<p class="concept">Save an idea or a little fragment. It will be waiting here.</p>'}`;return;}
content.innerHTML=`<div class="topline"><span class="eyebrow">${view==='song'?'Song in progress':'A place to start'}</span><span class="serial">no. 0${index+1}</span></div><h1>${d.title.map(t=>`<span class="title-strip">${esc(t)}</span>`).join('')}</h1><p class="concept">${esc(d.concept)}</p>${view==='song'?`<label class="eyebrow" for="sr-draft">Your lyrics</label><textarea id="sr-draft" placeholder="Start anywhere…">${esc(d.draft||'')}</textarea><div class="eyebrow">Starting lines · not yet in your lyrics</div><div class="seed"><p class="lines">${esc(d.lines)}</p><button class="cursor-interaction" id="sr-use">Add to lyrics ↗</button></div>`:`<div class="seed"><div class="eyebrow">A first thread</div><p class="lines">${esc(d.lines)}</p></div>`}<div class="hand">${view==='song'?'Your scraps, still here':'What does this make you think of?'}</div><div>${fragments(d)}</div><form id="sr-add"><input id="sr-fragment" aria-label="Add a fragment" placeholder="A phrase, a memory, half a line…" maxlength="400" autocomplete="off"><button class="cursor-interaction" aria-label="Add fragment">＋</button></form><div class="actions">${view==='song'?'<button class="secondary cursor-interaction" id="sr-back">← Back to idea</button><button class="primary cursor-interaction" id="sr-save-song">Save song</button>':`<button class="secondary cursor-interaction" id="sr-save">${d.saved?'Idea saved ✓':'Save idea'}</button><button class="primary cursor-interaction" id="sr-start">${d.draft!==undefined?'Continue song ↗':'Start writing ↗'}</button>`}</div><div class="status" id="sr-status" role="status" aria-live="polite"></div>`;
}
root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=ideas[index];if(b.dataset.nav){view=b.dataset.nav;render();}else if(b.dataset.open!==undefined){index=Number(b.dataset.open);view='ideas';render();}else if(b.dataset.saveFragment!==undefined){d.fragments[Number(b.dataset.saveFragment)].saved=true;render();status('Fragment saved to your journal.');}else if(b.id==='sr-next'){index=(index+1)%ideas.length;render();}else if(b.id==='sr-prev'){index=Math.max(0,index-1);render();}else if(b.id==='sr-save'){d.saved=true;render();status('Idea and its fragments saved.');}else if(b.id==='sr-start'){if(d.draft===undefined)d.draft='';view='song';render();}else if(b.id==='sr-back'){view='ideas';render();}else if(b.id==='sr-use'){d.draft=(d.draft?d.draft+'\n\n':'')+d.lines;render();status('Starting lines added.');}else if(b.id==='sr-save-song'){d.saved=true;status('Song saved to your journal.');}});
root.addEventListener('submit',e=>{if(e.target.id!=='sr-add')return;e.preventDefault();const input=root.querySelector('#sr-fragment'),text=input.value.trim();if(!text)return;ideas[index].fragments.push({text,saved:false});render();root.querySelector('#sr-fragment').focus();status('Added to this idea.');});
root.addEventListener('input',e=>{if(e.target.id==='sr-draft')ideas[index].draft=e.target.value;});render();
})();
</script>
</div></div>

```
