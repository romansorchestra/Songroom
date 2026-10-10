# Builds research/pack/profiles.jsonl. Editable reference summaries, not impersonation instructions.
# Each characteristic carries its own evidence label. Run: python3 -I build_profiles.py
import json
P = []
def prof(id, name, aliases, resolved, sample, sources, requested_by, characteristics, variation, uncertain, cards):
    P.append(dict(id=id, version=1, name=name, aliases=aliases, resolved=resolved, sample=sample, sources=sources,
                  requested_by=requested_by, characteristics=characteristics, variation=variation, uncertain=uncertain,
                  related_cards=cards, last_checked="2026-10-10",
                  note="Reference summary for translating a named reference into editable qualities. Never an instruction to imitate or reproduce."))

D, O, I = "documented_statement", "observable_feature", "analytical_inference"

prof("P01", "ADÉLA", ["Adela", "Adéla Jergová", "PRIMA"],
 "Adéla Jergová, b. 27 Nov 2003, Bratislava, Slovakia; trained in ballet; cut early from The Debut: Dream Academy (2023); signed to Capitol (Polydor UK). Debut album PRIMA released 2026-09-04, 11 tracks, executive producers Dylan Brady and Blake Slatkin. Singles: KGB (2026-04-16), Red Bottoms (2026-06-11), Ain't In LA (2026-07-22), Nicole Kidman. Earlier: Homewrecked (independent), SexOnTheBeat. UK: Nicole Kidman No. 4 and Ain't In LA No. 12 (chart dated 2026-09-25); album UK No. 2; US Billboard 200 debut No. 4 (chart week unverified).",
 ["KGB", "Red Bottoms", "Ain't In LA", "Nicole Kidman", "Hitachi", "Therapy", "Boys", "Marijuana", "Starving Artist", "I'm The Man"],
 ["AD-S3", "AD-S10", "AD-S13", "AD-S16", "AD-S17", "AD-S18", "AD-S20", "AD-S24", "AD-S26", "AD-S36", "AD-S37", "AD-S46", "AD-S50"],
 "Sam, 9 Oct 2026 (named with the album 'Prima')",
 [
  {"text": "Says she is blunt by culture and dry and sarcastic; uses humour to carry things that aren't funny.", "evidence": D},
  {"text": "Titles are often loaded proper nouns or brands (KGB, Nicole Kidman, Red Bottoms, Hitachi, Marijuana); in every case she explains, the noun stands for a feeling (a corset moment = feeling like a movie star; a worn shoe = feeling run down), not the topic.", "evidence": I},
  {"text": "Place or identity as stance: Ain't In LA defines the narrator by refusing the famous city, moving from one specific girl (verse 1, domestic detail) to girls everywhere (verse 2), with a pitched-down male refrain by Theron Thomas.", "evidence": O},
  {"text": "Mixes registers on purpose: swagger with vulnerability, witty with deep; pushed herself into love songs for this album after avoiding them.", "evidence": D},
  {"text": "Comic literal personas (KGB as a spy absorbing American culture) can be misread as metaphor or politics; she added a disclaimer in the video.", "evidence": D},
  {"text": "Spoken friend-banter between sections (Boys, with Lara Raj) for comedy and attitude.", "evidence": O},
  {"text": "Critics split: Rolling Stone wants her deadpan and showing not telling; NME wants her winking; both punished lines that stated the obvious. Sincere/slow tracks (Therapy, Hitachi, Marijuana) drew the most criticism.", "evidence": O},
 ],
 "Her upbeat singles and her ballads are received very differently; Therapy was cut from a 15-minute ramble and judged simple, while Hitachi was called terrific by Clash and a slog by a user reviewer. Treat 'ADÉLA' as a reference for attitude, camp, blunt humour and proper-noun hooks, not for ballad writing.",
 "Per-track writer credits rest on an uncited Wikipedia table except Ain't In LA, Hitachi, Nicole Kidman and (producer only) I'm The Man. No statement from her about writing in English as a second language; nothing from Brady or Slatkin about the sessions; no documented changed lines.",
 ["C14", "C33", "C41", "C49", "C26", "C54"])

prof("P02", "Amy Allen", ["Amy Allen"],
 "American songwriter (Maine-born), Grammy Songwriter of the Year, Non-Classical (2025). Artist releases: EP AWW! (2021-11-05), album Amy Allen (2024-09-06); no solo release found 2025–26. Verified co-writes (sample): Espresso, Please Please Please, Manchild and every track on Short n' Sweet and Man's Best Friend (Sabrina Carpenter); Adore You and Matilda (Harry Styles; NOT As It Was); Greedy (Tate McRae; credits via Genius only); Selfish (Justin Timberlake; uncited); Without Me (Halsey); Back to You (Selena Gomez, 2018); pretty isn't pretty (2023) and Drop Dead (2026) (Olivia Rodrigo). NOT credited on Tate McRae's Sports car or Revolving door.",
 ["Espresso", "Please Please Please", "Manchild", "Adore You", "Greedy", "Without Me", "Back to You"],
 ["AA-S2", "AA-S3", "AA-S4", "AA-S5", "AA-S7", "AA-S8", "AA-S9", "AA-S10", "PA-S11"],
 "Sam, 9 Oct 2026",
 [
  {"text": "Chorus first when writing with artists ('the crux'); if the artist later rejects the chorus, expect the concept to change (Greedy). For her own album she wrote front to back on purpose.", "evidence": D},
  {"text": "Keeps the line the room flags as too weird, too personal or too niche: 'usually the best part of the song', about nine times in ten.", "evidence": D},
  {"text": "Bad at writing from a handed title ('a Sudoku puzzle'); finds the song by talking with the artist about their life; listens for the subject they keep returning to.", "evidence": D},
  {"text": "Reaches for harder emotions first; writes with a guitar so the song stands up stripped; learned from Carpenter that humour can live inside a hit.", "evidence": D},
  {"text": "Has spent recent years undoing structural habits (a song doesn't need every trick every time, e.g. not always going straight to the chorus).", "evidence": D},
  {"text": "On Carpenter sessions: vulnerable conversation swings to hysterical laughter within a minute; the two decide out loud whether to 'really say that' line.", "evidence": D},
 ],
 "Her Carpenter work (comic, sweet-then-blunt) differs from Without Me (became an empowerment song unintentionally) and from her own darker album. A co-writing credit does not say which line is hers; the only Espresso writing account is Bunetta's.",
 "No Allen account of writing Espresso or Manchild (the Hollywood Reporter piece was blocked). No documented rejected lines beyond 'the Greedy chorus lyric and concept changed'. She does not speak in Song Exploder 284.",
 ["C03", "C38", "C35", "C29", "C05"])

prof("P03", "Sabrina Carpenter room (Carpenter / Allen / Antonoff / Bunetta / Jones)", ["Sabrina Carpenter", "Short n' Sweet", "Man's Best Friend"],
 "Sabrina Carpenter (US pop). Short n' Sweet (2024): Espresso (2024-04-11; Carpenter, Allen, Julian Bunetta, Steph Jones), Please Please Please (2024-06-06; Carpenter, Allen, Jack Antonoff), Taste. Man's Best Friend (2025): Manchild (Carpenter, Allen, Antonoff), Tears. Credits verified per track in AA-S* and PA-S* records.",
 ["Espresso", "Please Please Please", "Manchild", "Taste", "Tears"],
 ["AA-S2", "PA-S1", "PA-S3", "PA-S4", "PA-S5", "PA-S6", "PA-S12", "PA-S14", "PA-S18", "AA-S5"],
 "Sam, via Amy Allen reference",
 [
  {"text": "Lyrics are often literal things Carpenter said in conversation; she sings as acting, picturing the person, moving between sung and spoken phrasing; likes a line sung sweetly that turns blunt two seconds later.", "evidence": D},
  {"text": "Humour before hurt: sincere line, then the joke that undercuts it (Please Please Please bridge); subjects picked because they can be framed as funny.", "evidence": D},
  {"text": "Hooks can arrive from sung improvisation over a groove with no concept (Espresso: 20-minute burst, then hours of word changes); a 'silly' line kept because it sat on the melody.", "evidence": D},
  {"text": "Spoken interjection at the top (Manchild's eye roll) sets fond exasperation, partly at herself, before any insult.", "evidence": D},
  {"text": "Limit: by Man's Best Friend, critics (Slant, Guardian, Independent, LA Times) found the puns, innuendo and profanity overused and 'reaching for a memeable lyric'.", "evidence": O},
 ],
 "Espresso (nonsense-adjacent confidence) and Please Please Please (polite plea with an edge) and Manchild (insults on a sweet tune) use different mechanisms; do not reduce the room to 'cheeky'.",
 "No writer statements on Taste or Tears; Manchild's writing process undocumented beyond its opening gesture.",
 ["C01", "C03", "C05", "C34", "C49"])

prof("P04", "Olivia Rodrigo & Dan Nigro", ["Olivia Rodrigo", "Dan Nigro", "GUTS", "SOUR"],
 "Olivia Rodrigo (US pop/rock) with producer and co-writer Dan Nigro. SOUR (2021): drivers license, deja vu, good 4 u (interpolation credits added later). GUTS (2023): vampire, bad idea right?, get him back!, lacy, the grudge, pretty isn't pretty (with Amy Allen). Third album 'you seem pretty sad for a girl so in love' released 2026-06-12, produced by Nigro; singles drop dead (2026-04-17, with Amy Allen), the cure (2026-05-22), stupid song. Song Exploder 321 covers the cure.",
 ["the cure", "vampire", "get him back!", "bad idea right?", "lacy", "the grudge", "drivers license", "deja vu"],
 ["OR-S2", "OR-S3", "OR-S5", "OR-S7", "OR-S8", "OR-S9", "OR-S10", "OR-S13", "OR-S14", "OR-S18", "OR-S20", "OR-S22", "OR-S24"],
 "Sam, 9 Oct 2026 (one of three differing directions)",
 [
  {"text": "Lyric-focused: her aim in a session is that every word lands; Nigro guards syllable counts and melodic symmetry and adds 'a little abstraction'.", "evidence": D},
  {"text": "Not precious about a bad chorus: threw out the cure's first chorus, kept one image for the outro; replaced a wordier second verse with one harsh line.", "evidence": D},
  {"text": "Each sampled song uses a different method: ballad turned double-time 'rock opera' (vampire); a joke premise played straight, mostly spoken (bad idea right?); a title that means two opposite things (get him back!); a lyric written first as a poem, left ambiguous (lacy); a reply to a Morrissey line (the grudge); an open question inside a happy relationship (the cure).", "evidence": D},
  {"text": "Structure: drivers license treated as verse, turnaround, tag, with the chorus a build to a maximal bridge; the cure withholds drums past the expected arrival so the payoff is earned.", "evidence": D},
  {"text": "Never specifies who a song is about; directness means precision about the feeling with facts loose enough to borrow.", "evidence": D},
  {"text": "Limit: critics have called some images on-the-nose (vampire chorus), the grudge maudlin, and the 2026 album's first half melodramatic and repetitive; several GUTS songs share one escalation shape.", "evidence": O},
 ],
 "From spoken joke-song to piano confession to rock escalation; the constant is literal word-level care, not one sound.",
 "No first-hand statement on the get him back! double meaning, on pretty isn't pretty, or on whether lacy's unresolved envy was deliberate.",
 ["C08", "C22", "C23", "C28", "C46", "C47", "C31", "C39"])

prof("P05", "Chappell Roan (with Dan Nigro, Justin Tranter)", ["Chappell Roan", "Good Luck, Babe!"],
 "Chappell Roan (US pop). Good Luck, Babe! (2024-04-05; Roan, Nigro, Tranter; US Hot 100 peak No. 4, chart dated 2024-09-28; UK No. 2). The Subway (2025). No 2026 release found.",
 ["Good Luck, Babe!", "The Subway"],
 ["PA-S19", "PA-S20", "PA-S22", "PA-S23", "PA-S24", "PA-S26"],
 "Comparison, contemporary pop",
 [
  {"text": "Title address word changed from a real name (Jane) to Babe because it felt more sarcastic and playful; the sarcasm points outward.", "evidence": D},
  {"text": "Verses rewritten from sharp and barbed to effortless and casual, with one carefree physical image; chorus fixed by register and key, not new words; bridge improvised in two minutes over looped pre-chorus chords after a year of work.", "evidence": D},
  {"text": "The Subway: a grief song that is serious and not serious, with an absurdly specific escape plan as the release valve.", "evidence": D},
 ],
 "Anger-driven outward sarcasm (Good Luck, Babe!) vs self-deprecating grief (The Subway).",
 "No Song Exploder episode; original verse lines undocumented.",
 ["C07", "C32", "C21", "C45", "C05"])

prof("P06", "Gracie Abrams & Audrey Hobert", ["Gracie Abrams", "Audrey Hobert", "That's So True"],
 "Gracie Abrams (US singer-songwriter pop) with best friend and co-writer Audrey Hobert. That's So True (2024; Abrams, Hobert, verified), I Love You, I'm Sorry (2024; Song Exploder 2024-12-04). Hobert's own debut single Sue Me (2025).",
 ["That's So True", "I Love You, I'm Sorry", "Sue Me"],
 ["PB-S1", "PB-S2", "PB-S4", "PB-S5", "PB-S6", "PB-S9", "PB-S10", "PB-S11", "PB-S14"],
 "Comparison, conversational pop",
 [
  {"text": "Laughter as the filter: keep the line that makes the two of them laugh hardest; 'the petty part' is a feature; first That's So True lyrics were much nastier and were filed down.", "evidence": D},
  {"text": "'Mouthfeel': words kept for how they sit in the mouth when strung together; voice memos half-mumbled between speech and singing.", "evidence": D},
  {"text": "Bridge = the narrator's own admission, set apart by a rhythm change; verses hold the past and the pettiness.", "evidence": D},
  {"text": "Hobert: say plainly what you want to say; make them laugh and tell the truth; favourite line hangs on a petty brand detail.", "evidence": D},
  {"text": "Limit: Paste heard Sue Me as affected diary-pop; Abrams admits a verse line hurt its subject.", "evidence": O},
 ],
 "Abrams' hurt-sincere register and Hobert's deadpan comedy are related but not the same voice.",
 "Which lines changed between the crude draft and release is undocumented; Abrams declined to take the That's So True bridge apart.",
 ["C04", "C17", "C45", "C11", "C37"])

prof("P07", "Charli XCX", ["Charli XCX", "brat", "Girl, so confusing", "Camera"],
 "Charli XCX (UK pop/dance). Girl, so confusing (2024, brat; co-writer A. G. Cook) and its Lorde reply version; Camera (2026; Song Exploder 2026-08-19; collaborators named in transcript: Finn Keane, A. G. Cook; formal credits unverified).",
 ["Girl, so confusing", "Girl, so confusing (version with Lorde)", "Camera"],
 ["PB-S29", "PB-S31", "PB-S34", "PB-S35", "PB-S41"],
 "Comparison, social-observation pop",
 [
  {"text": "Writes a social situation plainly, as she would say it privately to friends; jealousy is not treated as un-supportive.", "evidence": D},
  {"text": "An answer verse from the person addressed (Lorde) turned a petty monologue into a dialogue; the reply works because it accepts some blame.", "evidence": D},
  {"text": "Camera: dropped rhyme for an embarrassing inner monologue because rhyme implies premeditation; melody is about conviction even on one note; a blunt outro line not meant to be clever.", "evidence": D},
 ],
 "brat-era social confession vs 2026 stream-of-consciousness; the no-rhyme choice is one song's.",
 "Camera credits unverified; the Billboard brat cover story was blocked (quotes via Complex/NME/Nylon/Stereogum).",
 ["C09", "C24", "C04", "C54"])

prof("P08", "Lola Young", ["Lola Young", "Messy"],
 "Lola Young (UK). Messy (2024; writers Lola Young and Conor Dickinson; Carter Lang producer only; release date uncited on Wikipedia). 2025 album with explicit tags on 8 of 12 tracks (Independent).",
 ["Messy"],
 ["PB-S15", "PB-S17", "PB-S19", "PB-S20", "PB-S23"],
 "Comparison, blunt UK pop",
 [
  {"text": "Started as a bedroom demo at the end of a relationship, then turned to her relationship with herself; many accusations were self-criticism; addressee is a composite (family as well as men).", "evidence": D},
  {"text": "Reviewer: an itemised complaint about someone who faults the narrator for opposite things, sung like an angry voicemail, anger rising section by section without new information; frequent profanity.", "evidence": O},
  {"text": "Limit: a whole album committed to mess blurs (Independent).", "evidence": O},
 ],
 "Single-song evidence; UK press on her was thin (Guardian, Rolling Stone, NME body blocked).",
 "Nothing on how the swearing or the order of lines was decided.",
 ["C06", "C23", "C50", "C14"])

prof("P09", "Tate McRae", ["Tate McRae", "Greedy", "Sports car"],
 "Tate McRae (Canadian pop). Greedy (2023; written with Ryan Tedder, Amy Allen, Jasper Harris), Sports car and Revolving door (2025; McRae, Julia Michaels, Ryan Tedder, Grant Boutin). Amy Allen NOT credited on the 2025 songs.",
 ["Greedy", "Sports car", "Revolving door"],
 ["PB-S54", "PB-S55", "PB-S57", "PB-S58", "PB-S59", "AA-S3"],
 "Comparison, attitude-led pop",
 [
  {"text": "Attitude as a character: an alter ego who takes over on stage; many songs are 'not how I would talk in real life'; Greedy built from rapping ideas over a beat around one scene (a man at a bar).", "evidence": D},
  {"text": "Greedy's chorus lyric was rejected weeks after the session and the concept changed (per Amy Allen).", "evidence": D},
  {"text": "Sports car: a deniable two-level object metaphor for a first explicit song; whispered spoken chorus (per critics).", "evidence": D},
  {"text": "Limit: critics described the 2025 songs mainly through comparisons to earlier pop; Revolving door's chorus 'builds to very little' (Paste).", "evidence": O},
 ],
 "Persona swagger (Greedy) vs sensual metaphor (Sports car); same room, different mechanisms.",
 "No writer statements on Revolving door's words; the MixWithTheMasters video on Greedy is paywalled.",
 ["C26", "C59", "C38"])

prof("P10", "Addison Rae", ["Addison Rae", "Diet Pepsi", "Headphones On"],
 "Addison Rae (US pop). Diet Pepsi (2024; hook written the day she met Elvira Anderfjärd and Luka Kloser), Headphones On (2025; Rae, Anderfjärd, Kloser).",
 ["Diet Pepsi", "Headphones On"],
 ["PB-S42", "PB-S45", "PB-S46", "PB-S47"],
 "Comparison, sound-led pop",
 [
  {"text": "Title promoted from the oddest concrete noun in the lyric (Backseat became Diet Pepsi on Charli XCX's suggestion); likes trying different deliveries of a line.", "evidence": D},
  {"text": "Melody-first reports are second-hand; no writer statement on the words of Headphones On.", "evidence": O},
 ],
 "Two songs, thin evidence.",
 "Rolling Stone pieces blocked; nothing on how the words were chosen.",
 ["C33", "C18"])

prof("P11", "Alex Warren (Ordinary)", ["Alex Warren", "Ordinary"],
 "Alex Warren (US). Ordinary (2025; Warren, Cal Shapiro, Mags Duval, Adam Yaron; written at a camp in about 24 hours).",
 ["Ordinary"],
 ["PB-S62", "PB-S63", "PB-S64", "PB-S65", "PB-S14"],
 "Comparison, direct devotional pop",
 [
  {"text": "Some solemn-sounding lines began as jokes about a dusty house; chorus sketched first in voice memos; verse 1 and verse 2 have different melodic structures; key raised seven semitones so a low chorus start jumps an octave.", "evidence": D},
  {"text": "Reception split: Paste ranked it among the worst of 2025 ('bloodless and generic'); listeners use it for weddings and memorials; Warren's theory that a great ballad leaves you unsure whether it is about love or death.", "evidence": O},
 ],
 "One song; the lesson is about portability vs specificity, not a voice.",
 "Nothing on word choice; the Variety piece has no byline or date.",
 ["C12", "C21"])

prof("P12", "Billie Eilish & Finneas", ["Billie Eilish", "Finneas", "Birds of a Feather", "Wildflower", "Lunch"],
 "Billie Eilish with Finneas (US). Hit Me Hard and Soft (2024): Birds of a Feather (Spotify's most-streamed song of 2024; three weeks No. 1 Billboard Global 200), Wildflower (Song of the Year, 2026 Grammys), Lunch. No 2026 release found.",
 ["Birds of a Feather", "Wildflower", "Lunch"],
 ["PA-S30", "PA-S31", "PA-S32", "PA-S33", "PA-S34", "CT-S30", "CT-S35"],
 "Comparison, plain-language pop",
 [
  {"text": "Lyrics must feel completely authentic to Billie (Finneas); he calls himself a lyric person and finds boring lyrics on a beautiful melody less forgivable; satisfied by words not used every day.", "evidence": D},
  {"text": "Birds of a Feather reverses a stock devotion trope and slips in something dark; Eilish wanted to cut it as 'a bit stupid'.", "evidence": D},
  {"text": "Wildflower grants the partner's love up front and puts the problem inside the narrator; Lunch verse written in a friend's voice with jokes allowed ('embrace cringe'); a hook can wait a year for its verses.", "evidence": D},
  {"text": "A line in What Was I Made For? that doesn't explain itself was the first one listeners understood.", "evidence": D},
 ],
 "Sincere-plain (Birds of a Feather) and comic-desire (Lunch) in the same album.",
 "Finneas's video remarks and Eilish's WSJ remarks are relayed second-hand.",
 ["C02", "C29", "C22", "C60", "C12"])

prof("P13", "Nashville writers' room (Morgan Wallen catalogue)", ["Morgan Wallen", "Ashley Gorley", "Nashville", "country room", "Charlie Handsome", "ERNEST"],
 "Morgan Wallen (US country) as performer; writers include Ashley Gorley, John Byron, Jacob Kasher Hindlin, Charlie Handsome (Ryan Vojtesak), ERNEST, Chandler Walters, Post Malone. Last Night (2023), I Had Some Help (2024, with Post Malone), Love Somebody (2024; 6 writers per label, 11 per Wikipedia), I'm the Problem (2025 album, 37 tracks). Comparison hits: Shaboozey A Bar Song (Tipsy) (2024), Ella Langley & Riley Green you look like you love me (2024), Zach Bryan (sole writer).",
 ["Last Night", "I Had Some Help", "Love Somebody", "I'm the Problem", "you look like you love me", "When It Rains It Pours", "Sangria", "Girl Crush"],
 ["CW-S3", "CW-S5", "CW-S6", "CW-S7", "CW-S17", "CW-S19", "CW-S20", "CW-S21", "CW-S24", "CW-S25", "CW-S26", "CW-S27", "CW-S28", "CW-S29", "CW-S36", "CW-S46", "CW-S47"],
 "Sam, 9 Oct 2026 (Morgan Wallen as one of three differing directions); comparison group, not a template",
 [
  {"text": "Beat/loop first, hook tested first, fast writes to a fixed artist target (Last Night from an 8-bar voice-note loop; I Had Some Help in about 24 minutes); Handsome concedes a hit hook can carry weak verses.", "evidence": D},
  {"text": "Titles from room talk with tense/person shifted into an admission; idiom flips (When It Rains It Pours); the detail that makes a title true for the singer (Sangria); sing-testing a title (Runnin' Outta Moonlight 'sang better').", "evidence": D},
  {"text": "Everyday phrases with a second reading that moves the blame or means 'the end' (Last Night, I'm the Problem, Lies Lies Lies); fights left unresolved.", "evidence": O},
  {"text": "Spoken 'talking country' verses under a sung chorus (you look like you love me).", "evidence": D},
  {"text": "Limits admitted from inside: McAnally calls the trend 'a rearranging of the same thing' and writes it too; Gorley says big co-writing teams and radio pressure produce songs that don't come from the soul; critics find I'm the Problem formulaic (whiskey, drives, exes); Chartmetric links more writers per song to more repeated words (correlation only).", "evidence": D},
 ],
 "The craft moves (flip, revealing detail, sing-test, cull the B song) are separable from the imagery (drink, truck, small town) and the blame-trading persona. Zach Bryan is the sole-writer outlier.",
 "No first-hand craft interview with John Byron or Jacob Kasher Hindlin; no transcript of Gorley's Songcraft episode on Last Night; release dates missing for the I'm the Problem single, Something in the Orange and Lies Lies Lies; several sources predate 2023.",
 ["C55", "C25", "C31", "C35", "C40", "C48", "C53", "C18"])

prof("P14", "Ed Sheeran (with Johnny McDaid, Ilya, Savan Kotecha)", ["Ed Sheeran", "Play", "Azizam", "Sapphire", "Old Phone"],
 "Ed Sheeran (UK). Play (2025-09-12): Azizam (2025-04-04; Sheeran, Ilya Salmanzadeh, Johnny McDaid, Savan Kotecha), Old Phone (2025-05-01; Sheeran alone), Sapphire (2025-06-05; adds Mayur Puri, Arijit Singh, Avinash Chouhan), A Little More (2025-08-07; Sheeran, Blake Slatkin, Cirkut, McDaid, Dave). Jonny Coffer not credited on these. Enduring example: Shape of You (2017; Sheeran, Steve Mac, McDaid).",
 ["Azizam", "Sapphire", "Old Phone", "A Little More", "Shape of You"],
 ["ST-S17", "ST-S18", "ST-S19", "ST-S21", "ST-S24", "ST-S25", "ST-S27", "ST-S29", "ST-S30", "ST-S32", "ST-S50"],
 "Sam, 9 Oct 2026 (one of the differing directions)",
 [
  {"text": "Rhythm and sound first: sings in 'phonetics' and the words follow; on Shape of You melodies began as wordless syllables over a loop and sections were differentiated by rhythm, lyric and dynamics; McDaid objected to the chorus phrase on meaning and it was widened.", "evidence": D},
  {"text": "High-volume partnership: Sheeran 'macro' (floods of ideas, holds the whole song), McDaid 'micro' (guards the precious few).", "evidence": D},
  {"text": "Enters an unfamiliar idiom through what matches his own roots (Azizam's Persian scales felt like Irish trad); a one-word foreign endearment as the hook; Old Phone from a real object holding dated, unedited evidence.", "evidence": D},
  {"text": "Limit: critics heard Azizam's Persian element as mostly a chorus counter-melody and its English lyric as weak (Independent); Sapphire reviews split from best track (BBC) to banal (Independent).", "evidence": O},
 ],
 "Loop-and-phonetics pop (Shape of You, Azizam) vs sole-written confessional (Old Phone).",
 "No Ilya or McDaid interview about the Play songs; nothing first-hand on how the Old Phone lyric was drafted. The Sheeran v Chokri judgment ([2022] EWHC 827 (Ch)) likely holds the fullest sworn account of the Shape of You session and was not fetched.",
 ["C17", "C53", "C33"])

prof("P15", "Tyler, the Creator", ["Tyler the Creator", "CHROMAKOPIA", "Don't Tap the Glass"],
 "Tyler, the Creator (US hip-hop). CHROMAKOPIA (2024-10-28): Noid, Like Him, Hey Jane, Take Your Mask Off (adds Kathryn Thomas, Gregory Cook), Thought I Was Dead. DON'T TAP THE GLASS (2025-07-21; 10 tracks, 28:30; made on tour; stated rule: no intros, no outros, no bridges). No 2026 album found.",
 ["Hey Jane", "Like Him", "Take Your Mask Off", "Noid", "Thought I Was Dead"],
 ["ST-S35", "ST-S36", "ST-S37", "ST-S38", "ST-S39", "ST-S40", "ST-S41", "ST-S44", "ST-S45", "ST-S47", "ST-S48"],
 "Sam, 9 Oct 2026 (one of the differing directions)",
 [
  {"text": "Concept from a gap in what people know (life before 17); writes what he thinks about alone; leaves the frame unexplained and tells fans the second listen is when it hits.", "evidence": D},
  {"text": "Two-voice scenes: Hey Jane gives the partner a full reply that lands harder; Like Him lets his mother's recorded voice answer; Take Your Mask Off is three portraits with the same closing address and the narrator last.", "evidence": O},
  {"text": "Comic wordplay next to stark reflection (press); messaging sometimes called confused.", "evidence": O},
  {"text": "Can swap a heavily framed record for a deliberately unframed one ('not trying to be good, precious or innovative').", "evidence": D},
 ],
 "Framed concept album vs no-frills tour record within nine months.",
 "No long-form craft interview exists; no press analysis of his internal rhyme or rhythmic density was fetched, so no claim is made about them. Slant finds the Hey Jane sequence sanitised and the portraits patronising.",
 ["C24", "C51", "C05", "C44"])

prof("P16", "Noah Kahan (Stick Season)", ["Noah Kahan", "Stick Season"],
 "Noah Kahan (US folk-pop). Stick Season (2022; built in public: verse posted, chorus written 29 Oct, second verse after fans asked). Song Exploder transcript used.",
 ["Stick Season", "Northern Attitude"],
 ["ST-S1", "ST-S3", "ST-S4"],
 "Comparison, narrative singer-songwriter",
 [
  {"text": "Chorus sung in a borrowed country twang to get outside himself; kept the verse's chords because a folk song should stay simple.", "evidence": D},
  {"text": "Feared Vermont specificity would alienate outsiders; the particular is what connected; a late line came from literally living in Strafford after friends left; second verse on family depression took days and was kept because the discomfort might help someone.", "evidence": D},
  {"text": "Last-chorus lift from harmony and gang vocals rather than new words; staging the lyric literally was judged a bit corny.", "evidence": D},
 ],
 "Single-song depth; the 'folk simplicity' rule is his for this song.",
 "Who called the gang vocal corny is unclear in the transcript; whether the regional term did the work is untested.",
 ["C41", "C26", "C50", "C11"])

with open('pack/profiles.jsonl', 'w') as f:
    for p in P:
        f.write(json.dumps(p, ensure_ascii=False) + '\n')
print(len(P), 'profiles written')
