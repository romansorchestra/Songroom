# Builds research/pack/cards.jsonl from the pilot findings. Run: python3 -I build_cards.py
# Every card cites finding IDs (raw/*/findings.jsonl) and source IDs (pack/sources.jsonl).
# Evidence labels follow SCHEMA.md. Examples are paraphrased; no lyric lines are reproduced.
import json

AUDIO = "Text-only research: nothing here was checked by listening. Any note about stress, vowels or delivery is provisional until sung."

C = []
def card(id, problem, technique, example, findings, sources, evidence, effect, contexts, genres, tasks, when_not, confidence, open_questions="", related=None, audio=AUDIO):
    C.append(dict(id=id, version=1, problem=problem, technique=technique, example=example, findings=findings, sources=sources,
                  evidence=evidence, effect=effect, contexts=contexts, genres=genres, tasks=tasks, when_not=when_not,
                  audio_caveat=audio, confidence=confidence, open_questions=open_questions, related=related or []))

# ---------------- WORDS AND PHRASES ----------------
card("C01",
 "The line sounds written. The artist has said the real thing in the room but it isn't in the lyric.",
 "Write down the artist's exact spoken wording during the conversation and build the lines around those phrases instead of translating them into lyric language.",
 "Justin Tranter says he opens sessions with a conversation that doubles as an interview, keeps exploring anything that could be a title, and for Reneé Rapp's songs put her exact phrases in and wrote more poetic lines around them. Jack Antonoff says many of Sabrina Carpenter's lyrics are literal things she said in conversation. Shane McAnally tells writers to put it in the song the way they'd say it in conversation.",
 ["CT-F12","AA-F3","PA-F3","CT-F11"], ["CT-S32","AA-S2","CT-S26","CT-S29"], "documented_statement",
 "The listener hears a person talking, not a writer writing; the phrase carries the speaker's real rhythm and attitude.",
 ["conversational","session_capture","artist_voice","co_write","verse","hook"], ["pop","country","any"], ["lines","edit","draft","ideas"],
 "Speech still has to sit on the melody: Carpenter describes a melody ending being moved lower so a spoken-style line would land. And a plain spoken phrase in a chorus may need the surrounding lines to give it weight.",
 "high", "", ["C02","C17"])

card("C02",
 "A line is clever or true but this singer would never say it.",
 "Read the line aloud as the narrator, to the person it addresses. If neither the writer nor the singer would say it that way, rephrase toward how they would; if the voice is a deliberate persona, make the persona consistent rather than 'natural'.",
 "Finneas says lyrics for Billie Eilish must feel completely authentic to her, so the test is whether she would say it. Carpenter says much of her phrasing is first instinct, how she would really say those things, and that she pictures the conversation while singing. Counter-case: Tate McRae says Greedy's brash voice is an alter ego and not how she talks in real life, and the song worked as a character.",
 ["CT-F11","PA-F3","PB-F12"], ["CT-S30","PA-S1","PB-S55"], "documented_statement",
 "Lines that pass the test sound like a person; lines that fail sound like a lyricist, and the listener notices at song speed.",
 ["conversational","artist_voice","persona","attitude","edit","lines"], ["pop","any"], ["lines","edit","draft"],
 "Do not flatten a stylised voice into plain talk: a persona (McRae's alter ego, Tyler's characters) is allowed to say things the artist wouldn't, as long as the voice holds across the song.",
 "high", "", ["C01","C26"])

card("C03",
 "Someone in the room says a line is too weird, too far, too niche or too silly.",
 "Treat the flinch as a reason to keep and test the line, not to cut it. Keep it in the draft, listen back cold, and only then decide.",
 "Amy Allen (NPR) says a flag goes up in sessions that a line is too weird, too pop, too personal or too specific, that the flagged part is usually the best part of the song, and that people love it about nine times in ten; her example is a profane word in a Carpenter single the room laughed at. Steph Jones says the room asked whether the Espresso hook line would stay because it was silly, and kept it.",
 ["AA-F4","PA-F5","PA-F1"], ["AA-S3","PA-S11","PA-S4"], "documented_statement",
 "The uncomfortable line is often the one listeners quote back, because it is the one that is specific to this writer.",
 ["cut_lines","humour","specificity","co_write","session_capture"], ["pop","any"], ["lines","edit","ideas"],
 "By Allen's own count about one flagged line in ten fails. Critics of Carpenter's 2025 album found the profanity and innuendo overused: a voice that always chases the dare stops surprising. Abrams says some lines that got a laugh sound weak on playback, so the cold re-listen is part of the technique.",
 "high", "", ["C04","C60"])

card("C04",
 "A petty, jealous or unreasonable line needs to be funny and true at once, not just mean.",
 "Draft the ugly version at full strength for the laugh, then file it down to sarcasm; use the writers' laughter as the first filter and a cold listen as the second.",
 "Gracie Abrams says she and Audrey Hobert often keep the line that makes them laugh hardest, calls one verse 'the petty part', and says the first That's So True lyrics were much nastier than the release. Hobert's stated goals are to make people laugh and tell the truth. Charli XCX said brat's lyrics are what she would say privately to friends.",
 ["PB-F1","PB-F5","PB-F6","PB-F9"], ["PB-S1","PB-S4","PB-S9","PB-S35"], "documented_statement",
 "The laugh carries the wound and the self-awareness together, so the narrator can be unreasonable without losing the listener.",
 ["petty","jealousy","humour","sarcasm","bluntness","conversational","verse"], ["pop"], ["lines","edit","draft","ideas"],
 "Abrams admits a verse line hurt the person it was about. And no source documents which lines changed between the crude draft and the release, so 'file it down' is her description of direction, not a recipe.",
 "high", "What exactly gets removed between the crude draft and the release is undocumented.", ["C03","C05","C06"])

card("C05",
 "Hurt or sadness is coming across as self-pity or as too heavy.",
 "Put the sincere line first and the undercutting joke straight after it. The laugh follows the hurt and sharpens it instead of covering it.",
 "Jack Antonoff says the best artists know exactly when to be funny because it makes the next sad line sadder, and describes the Please Please Please bridge pairing a heartbreaking line with one that undercuts it. Chappell Roan calls The Subway serious and not serious at once, citing an absurdly specific escape plan inside a grief song. Press on CHROMAKOPIA says the comic wordplay and stark reflection run side by side.",
 ["AA-F2","PA-F10","ST-F10"], ["AA-S2","PA-S24","ST-S39"], "documented_statement",
 "A joke next to a confession keeps the confession from sounding self-pitying and earns the listener's trust before the hard line.",
 ["humour","sarcasm","bridge","breakup","grief","self_mockery","verse"], ["pop","hiphop","any"], ["lines","edit","draft"],
 "If every line is a joke there is no sincere line for the humour to sharpen (Antonoff's point in reverse). Slant on Man's Best Friend: when every line winks, none lands as a reveal.",
 "high", "", ["C04","C06"])

card("C06",
 "The narrator is attacking someone and it reads as bitter or one-sided.",
 "Let the narrator implicate or mock herself before she accuses anyone: an eye roll at herself, a line that admits the accusation also applies to her, or an addressee who is partly the narrator.",
 "Carpenter describes the spoken opener of Manchild as a deep breath and an eye roll partly at herself. Eilish says Wildflower grants the partner's love and puts the problem inside the narrator. Lola Young says many of Messy's accusations turned out to be criticisms she aimed at herself and that the addressee is a composite. Exclaim hears Lorde's reply verse on Girl, so confusing work because it accepts some blame rather than matching the spiral.",
 ["PA-F16","PA-F4","PA-F14","PB-F7","PB-F9"], ["PA-S12","PA-S33","PB-S15","PB-S34"], "analytical_inference",
 "Once the narrator has turned the knife on herself, the listener lets her be harsh about the other person.",
 ["self_mockery","blame","breakup","confession","addressee","stance"], ["pop"], ["lines","edit","draft","ideas"],
 "Good Luck, Babe! points its sarcasm outward through the title and works, so self-implication is one route, not a rule. The pattern across these songs is the analyst's reading; the writers describe each case separately.",
 "medium", "No writer states this as a method; it is a pattern across four documented cases.", ["C05","C25"])

card("C07",
 "A hurt song feels strained; the verses are trying too hard to wound.",
 "Lower the verbal temperature of the verses and add one carefree physical image; keep the force in the chorus and the title.",
 "Dan Nigro says the early Good Luck, Babe! verses were sharper and more barbed, and they rewrote them to feel effortless, casual and laid-back; Roan asked for a line about arms out of a sunroof as a lighter moment, while the chorus kept the sarcasm.",
 ["PA-F7","PA-F6"], ["PA-S20","PA-S19"], "documented_statement",
 "The contrast makes the chorus's claim land harder, and the casual verse keeps the narrator likeable while she is being cruel.",
 ["verse","chorus","breakup","sarcasm","register","edit"], ["pop"], ["lines","edit","draft"],
 "The original barbed lines are not documented, so only the direction of the edit is known. A song whose whole point is the barb (a diss track) may want the heat in the verses.",
 "high", "", ["C05","C21"])

card("C08",
 "Second verse won't come; every attempt is wordier and worse.",
 "Cut to one blunt line the singer would flinch at saying aloud, instead of adding detail.",
 "Olivia Rodrigo says she tried and failed to write a wordier second verse for the cure, then wrote one short, harsh line, and likes it because it is a visceral thing to have to say; she tells writers not to be precious about a bad chorus either, having thrown hers out and kept one image for the outro.",
 ["OR-F2"], ["OR-S2"], "documented_statement",
 "The short line reads as the thing the narrator has been avoiding saying, so it lands as the song's admission.",
 ["second_verse","bluntness","admission","cut_lines","edit"], ["pop","singer_songwriter"], ["lines","edit","draft"],
 "A single blunt line depends on what has been built around it; critics have called some of Rodrigo's plainer images on-the-nose, so plainness is not self-justifying.",
 "high", "", ["C12","C14"])

card("C09",
 "An interior monologue sounds composed, as if the narrator has been rehearsing it.",
 "Loosen or drop the rhyme so the line sounds like it is happening now, and let conviction in the delivery carry it rather than melodic movement.",
 "Charli XCX (Song Exploder, Camera, 2026) says rhyme requires a bit of premeditation, which made it wrong for an embarrassing inner monologue, because it makes a line sound like a thought she is going back to rather than one happening now; she adds that a good melody is all about conviction, even on one note.",
 ["PB-F10"], ["PB-S41"], "documented_statement",
 "Unrhymed lines in a confessional section sound unplanned and present-tense; the listener overhears rather than is addressed.",
 ["interior_monologue","confession","delivery","stream_of_consciousness"], ["pop","dance"], ["lines","edit","draft"],
 "A choice for one song; she does not say rhyme is wrong for conversational pop in general. A chorus that needs to be sung back by a crowd usually wants its rhyme.",
 "medium", "Whether the same move suits a mid-tempo radio chorus is untested.", ["C10","C43"])

card("C10",
 "A rhyme has to survive an edit and the natural options are only slant.",
 "Treat rhyme type as a dial, not a pass/fail: perfect rhyme where the thought resolves, family rhyme (same vowel, related consonants) where it nearly resolves, vowel-only rhyme where it should stay open. Landing the same word again at the rhyme position is an accepted move in current pop and rap.",
 "Pat Pattison ranks perfect, family and assonance rhyme from closed to open and argues the more distant types can carry unresolved feeling. Nate Sloan (Switched On Pop) says God's Plan relies on identity rhymes and near rhymes with heavy repetition. Hillary Lindsey contrasts heartfelt songs with 'calculated' ones built around a rhyme.",
 ["CT-F3","CT-F4","CT-F11"], ["CT-S6","CT-S39","CT-S36"], "documented_statement",
 "The rhyme sounds discovered inside the thought; a perfect rhyme on a decorative word sounds imposed on it.",
 ["rhyme","edit","chorus","verse","unresolved"], ["any"], ["edit","lines"],
 "No fetched source says slant rhyme is 'the modern default'; Pattison frames rhyme type as a choice matched to feeling. Identity rhyme leans on groove and delivery and can read as lazy in a sparse ballad.",
 "high", "'Slant rhyme is the modern default' remains an unsourced assumption and should not be stated as fact in prompts.", ["C09","C18"])

card("C11",
 "A grudge, a crush or a complaint needs a detail, and the obvious details are props.",
 "Choose one small, checkable, petty detail (a brand the ex always wore, the object that was in the room) that changes what we know about the narrator or the other person, and state it plainly.",
 "Audrey Hobert says her favourite line in Sue Me hangs on the clothing brand an ex always wore. Steph Jones says an Espresso verse line came straight from the late-night studio where they worked. Josh Osborne says Sangria only worked once a single physical detail put the male singer in contact with the drink. Lori McKenna prefers one well-chosen detail that reveals more than naming the feeling.",
 ["PB-F6","PA-F1","CW-F9","CT-F14"], ["PB-S9","PA-S4","CW-S24","CT-S34"], "documented_statement",
 "A checkable detail makes the grudge funny and believable at once; the listener trusts the narrator because the detail could not have been invented for the rhyme.",
 ["detail","specificity","petty","verse","object","brand"], ["pop","country","singer_songwriter"], ["lines","edit","ideas","draft"],
 "A detail only reveals something if it changes who the narrator is or what they want; a run of props (tailgate, mason jar) is decoration. Paste heard Sue Me's quirky details as affected: a styled detail reads as a pose, a lived one doesn't. Tranter keeps the chorus plain and universal; implied detail is mainly a verse tool.",
 "high", "", ["C12","C43","C55"])

card("C12",
 "Should this line be plain and universal, or specific? Plain lines keep getting called generic.",
 "Decide on purpose which you are writing: portable plainness (any occasion, any listener) or particular specificity (this narrator, this room). Don't let the writer's own embarrassment at a simple sincere line decide it.",
 "Alex Warren's Ordinary: Paste called it bloodless and generic, while listeners put it under weddings and memorials; producer Adam Yaron says the plain chorus got its climax from a low start and an octave jump. Billie Eilish told the label Birds of a Feather was a bit stupid and wanted to cut it; it became Spotify's most-streamed song of 2024. Singles Jukebox critics split on Ain't In LA: too vague because LA is the only named place, versus a great shout-along chorus; it was her first Hot 100 entry.",
 ["PB-F14","PB-F15","PB-F16","PA-F12","AD-F10"], ["PB-S63","PB-S64","PB-S14","PA-S30","AD-S36"], "documented_statement",
 "Plain devotional or anthemic language travels to any listener's life; the same quality is what critics punish as generic.",
 ["plainness","generic","vagueness","devotion","love","chorus","specificity"], ["pop","any"], ["lines","edit","ideas","draft"],
 "Commercial success does not prove the lyric is good or explain why it worked: Ordinary's lift came from arrangement and key as much as words. Critics' preference for specificity is not the audience's.",
 "medium", "Which plain lines travel and which merely bore is not predictable from text alone.", ["C08","C11","C36"])

card("C13",
 "A fast, wordy section with little repetition: lines fly past and the listener loses the thread.",
 "Make each line either an instant visual picture or a phrase people already say, and after a dense run give the next phrase fewer syllables and longer notes.",
 "Bonnie McKee says Last Friday Night (T.G.I.F.) was fast and rhythmic with little repetition, so every line had to be a clear picture or a very conversational phrase; she started from a long list of fitting phrases and cut the tame ones. Max Martin says a section crowded with rhythm should be followed by one with longer notes or it becomes too much information.",
 ["CT-F17","CT-F8"], ["CT-S38","CT-S14"], "documented_statement",
 "At song speed the listener gets one pass at each line; pictures and stock phrases are parsed instantly, and the long note afterwards lets them catch up.",
 ["fast_wordy","density","rhythm","verse","conversational","comprehension"], ["pop","dance","hiphop"], ["lines","edit","draft"],
 "A slow ballad with a repeated hook can afford a line that needs a second listen. McKee's post is paywalled after the opening, so her draft process is not documented.",
 "medium", "", ["C01","C50"])

card("C14",
 "The narrator should sound blunt without the song sounding heavy.",
 "State the uncomfortable fact straight away, then undercut it with dry humour; keep the bluntness on facts and events rather than on announced feelings.",
 "ADÉLA calls herself a very blunt person, says humour makes it easier to face things that aren't funny, and contrasts Slovaks who say it straight with Americans who circle the point. Rolling Stone found her weakest moments the stated, told-not-shown ones, and her best when showing rather than telling.",
 ["AD-F5","AD-F12"], ["AD-S20","AD-S37","AD-S24"], "documented_statement",
 "Bluntness about what happened reads as character; bluntness about what the narrator feels reads as a caption.",
 ["bluntness","humour","stance","attitude","conversational"], ["pop"], ["lines","edit","ideas"],
 "Critics split on whether her voice works winking or deadpan; what they agreed on was punishing lines that were neither and simply stated the obvious.",
 "medium", "", ["C05","C08"])

# ---------------- MUSICAL LANGUAGE (text-only) ----------------
card("C15",
 "A replacement line has the right syllable count but fights the tune.",
 "Speak the line at normal pace, mark the stressed syllables, and check that every stressed syllable lands where the melody leans (beats 1 and 3 and their eighth-note equivalents in 4/4). Content words take stress; articles, prepositions, conjunctions and pronouns usually don't. Fix mismatches by changing word order or word choice before touching the tune.",
 "Pat Pattison's rule: set stressed syllables on stressed musical positions; his bad example sets a plea of 'come back' to a rhythm shaped like 'bridegroom', flipping the stress. Keppie Coutts adds that pronouns and endings like -ty and -ly are the syllables songs most often mis-stress.",
 ["CT-F1"], ["CT-S1","CT-S2"], "documented_statement",
 "Stressed syllables on weak positions sound hurried; unstressed syllables on strong beats sound flat. Correct stress is why a plain line can sing better than a clever one.",
 ["stress","rhythm","syllables","melody_fit","edit"], ["any"], ["edit","lines"],
 "A deliberate mis-stress can be expressive (Coutts reports a line stressing the weak word 'for' being kept after John Mayer judged it expressive). Breaks work when chosen, not accidental. Text-only: the app cannot hear the melody, so it can only check natural speech stress and syllable count.",
 "high", "", ["C16","C17"])

card("C16",
 "A rewrite touches a line that is sung to a melody another line already uses.",
 "Keep the syllable count identical to the matching line, and keep the stressed syllables in the same places. If the chorus doesn't lift, try moving where the pre-chorus starts relative to beat one before rewriting words.",
 "Savan Kotecha says that when a melodic phrase repeats, each repeat's lyric has to match it syllable for syllable; adding or dropping one syllable breaks the pattern. Dan Nigro says when a stanza has too many or too few words he and Rodrigo rework it for melodic symmetry.",
 ["CT-F5","OR-F11"], ["CT-S10","OR-S7"], "documented_statement",
 "Matching lines sing as one melody; a one-syllable drift makes the second line feel squeezed or padded.",
 ["syllables","stress","melody_fit","chorus","pre_chorus","edit","repetition"], ["pop","any"], ["edit","lines","draft"],
 "Julia Michaels says she writes from feeling and doesn't think about the song's mathematics at all; Yacoub and Tedder use these rules only to diagnose a draft that isn't working, not to generate the first one.",
 "high", "", ["C15","C21"])

card("C17",
 "A co-writer has a sung placeholder (nonsense syllables, a mumbled phrase) and real words are needed.",
 "Treat the placeholder's syllable count, stressed positions and stressed vowels as the template. Propose real words that keep those vowels on the long or stressed notes rather than reshaping the melody around new words.",
 "Shane McAnally describes a Ross Copperman demo sung on vowel sounds, and a line that began as nothing but syllables before words were fitted. Ed Sheeran described his method in testimony as singing 'phonetics' first with words following; on Shape of You the melodies began as wordless syllables. Antonoff says a goofy placeholder frees people to find a better melody; Finneas describes improvising placeholder lyrics into being. Gracie Abrams calls her half-mumbled voice memos a 'mouth-feel' thing: words are kept for how they sit in the mouth.",
 ["CT-F10","CW-F7","ST-F1","PB-F4"], ["CT-S25","CT-S27","CT-S28","ST-S30","ST-S32","PB-S1","PB-S4"], "documented_statement",
 "The finished words inherit the groove the placeholder already proved; the line sings before it means anything, and then it means something.",
 ["placeholder","melody_fit","syllables","stress","vowels","session_capture","rhythm"], ["pop","country","any"], ["edit","lines"],
 "Fitting words to sounds can produce lines that sing well and say little: McDaid objected to the Shape of You chorus phrase on meaning grounds after it worked rhythmically, and Steve Leslie links loop-driven stress patterns to a loss of conversational writing. Lori McKenna mostly starts from the lyric. No fetched source gives rules for which vowels suit held or high notes; that guidance is not sourced here.",
 "high", "Vowel-choice rules for held notes are unsourced; the app should not assert them.", ["C15","C18"])

card("C18",
 "Two wordings mean the same thing; which one?",
 "Sing both on the actual note (or say both aloud at tempo) and keep the one that moves better in the mouth, even if it means a near-synonym.",
 "Ashley Gorley says a title was changed from a 'wasting moonlight' idea to Runnin' Outta Moonlight because it sang better, and that he works out loud rather than on a notepad. Dan Wilson's short-form advice is to take care of the sounds and vowels first; Max Martin says a line wins when it means something and has the right phonetics.",
 ["CW-F6","CT-F9"], ["CW-S21","CW-S3","CT-S21","CT-S16"], "documented_statement",
 "The chosen wording stops drawing attention to itself as text; listeners remember what was easy to sing.",
 ["syllables","vowels","melody_fit","title","edit","delivery"], ["any"], ["edit","lines","ideas"],
 "Gorley gives no phonetic reason beyond 'sang better', so any vowel explanation is speculation. Finneas finds boring lyrics on a beautiful melody less forgivable: sound-first is a tie-breaker, not a licence for the duller line.",
 "medium", "", ["C17","C15"])

card("C19",
 "The words say 'unresolved' but the section feels tidy and settled.",
 "Change the section's shape before the words: an odd line count, one line clearly shorter or longer, shifting stress counts, or an ABBA scheme read as unsettled; four equal AABB lines read as settled. Give the most important line space after it.",
 "Pattison's warning example is a heartbreak verse in four equal AABB lines that, he says, sounds like reported facts; his fixes include shortening the fourth line, lengthening the last, an asymmetric rhyme scheme, or displacing the melody against the chord cycle.",
 ["CT-F2"], ["CT-S3","CT-S4","CT-S5"], "documented_statement",
 "Section shape is felt before it is noticed; an uneven shape makes the listener feel the instability the words describe.",
 ["section_shape","structure","unresolved","verse","rhyme","draft"], ["any"], ["draft","lines"],
 "He presents these as tools, not rules: settled feelings suit stable shapes, and most songs mix the two. Not a reason to break a chorus a crowd needs to sing back.",
 "high", "", ["C10","C45"])

# ---------------- MEANING AND VOICE ----------------
card("C21",
 "The chorus isn't landing and the instinct is to rewrite the words.",
 "Before rewriting the words, try the non-lyric fixes: sing chosen words in full voice, change the key, raise the chorus entry (low start then an octave jump), or rewrite the pre-chorus so it leaves the listener needing the chorus.",
 "Nigro says the Good Luck, Babe! chorus was fixed by deciding some words had to be sung in full voice, and on another pass by realising the key was wrong. Adam Yaron says Ordinary's chorus wasn't climactic enough, so they raised the key seven semitones and jumped an octave into it. Emily Warren writes the pre-chorus as a cliffhanger; Rami Yacoub says a chorus that doesn't land may really be a pre-chorus failing to set it up.",
 ["PA-F8","PB-F15","CT-F6","CT-F7"], ["PA-S20","PA-S19","PB-S64","CT-S11","CT-S13"], "documented_statement",
 "A chorus can feel weak for reasons that have nothing to do with the words; rewriting a good line to fix a register problem loses the line.",
 ["chorus","pre_chorus","register","key","edit","delivery"], ["pop","any"], ["edit","lines","draft"],
 "The app cannot hear the key or register; it can only suggest that the words may not be the problem. Gary Ewer's padding test: sing verse straight into chorus; if the chorus doesn't arrive too abruptly, the pre-chorus may be unnecessary.",
 "high", "", ["C16","C44"])

card("C22",
 "The brief is a happy love song and every draft sounds boastful or empty.",
 "Write the doubt the narrator still feels while in love, and leave it as a question the song does not answer.",
 "Olivia Rodrigo says songs about being happy in a relationship tended to sound boastful or empty, that her favourite love songs are sad, and that the cure admits unhappiness from inside a relationship and is a question rather than an answer. Billie Eilish says Wildflower grants the partner's love up front and puts the problem inside the narrator. Last Night (per press) never resolves the fight.",
 ["OR-F1","PA-F14","CW-F3"], ["OR-S2","PA-S33","CW-S46"], "documented_statement",
 "A question leaves the listener inside the feeling; an answer closes it. The unresolved version is the one people replay.",
 ["happy_love","love","question","unresolved","confession","chorus","ideas"], ["pop","country","singer_songwriter"], ["ideas","lines","draft"],
 "NPR's critic found parts of Rodrigo's 2026 album melodramatic because it doesn't step back far enough; an open question still needs one concrete anchor. A wedding song or a first-dance brief wants the answer.",
 "high", "", ["C06","C27"])

card("C23",
 "Who is the song about? Naming them makes it small; not naming them makes it vague.",
 "Keep the addressee unnamed or composite but anchor the feeling in one concrete, exact image; let listeners supply the face.",
 "Rodrigo says she never specifies who a song is about and that fan readings of lacy (an older sister, a former best friend, a past self) added colour she could not have planned. Lola Young says Messy's addressee is a composite, largely close family as well as men, so one song is a row and a self-portrait at once.",
 ["OR-F9","PB-F7"], ["OR-S5","PB-S15","PB-S20"], "documented_statement",
 "An unnamed addressee lets the listener cast the part; the narrator stays implicated rather than vindicated.",
 ["addressee","ambiguity","envy","jealousy","breakup","verse"], ["pop","singer_songwriter"], ["ideas","lines","draft"],
 "Rob Sheffield found lacy's meaning puzzling and the Telegraph mocked its central image: ambiguity tips into vagueness without a concrete anchor. A story song (a named character, a duet) wants the name.",
 "medium", "", ["C22","C24"])

card("C24",
 "A one-sided breakup or confession song; the other person is only a summary in the narrator's mouth.",
 "Give the other person a full verse (or a spoken reply) in their own voice, and let their reply land harder than the narrator's case.",
 "Press describes Hey Jane as Tyler rapping both sides of an unplanned pregnancy, with the partner's reply hitting harder and the song ending unresolved. Lorde's answer verse on Girl, so confusing accepts some blame; Charli says the song opened a channel that let Lorde say new things. Ella Langley's you look like you love me gives Riley Green a spoken reply verse, and the first time both sing together is the payoff.",
 ["ST-F8","PB-F9","CW-F10"], ["ST-S37","ST-S38","PB-S29","CW-S29","CW-S30"], "observable_feature",
 "A confession becomes a scene; the narrator doesn't get to win, which is why the listener believes both of them.",
 ["dialogue","duet","addressee","character","verse","blame","unresolved"], ["hiphop","pop","country"], ["ideas","draft","lines"],
 "Slant finds the Hey Jane sequence sincere but sanitised, with self-critique that never turns outward: two voices do not guarantee stakes. The device needs a reply that disagrees with the narrator, not one that agrees.",
 "medium", "", ["C06","C49"])

card("C25",
 "Where does the blame point, and does it move?",
 "Ask where the blame points in the first chorus and whether the last chorus can point it somewhere else (at the narrator, or at both). That shift can be the whole song.",
 "Critics (NPR's Ann Powers, Country Now, Paste) hear Wallen's I'm the Problem start as a confession and turn to accuse the ex, Lies Lies Lies move from attack to self-implication, and I Had Some Help split fault for a breakup. No writer in the fetched sources says they set out to make blame shift.",
 ["CW-F5","CW-F4"], ["CW-S17","CW-S16","CW-S19","CW-S9"], "analytical_inference",
 "A blame shift gives the repeated chorus a new meaning on its last pass without new words.",
 ["blame","breakup","last_chorus","double_meaning","country"], ["country","pop"], ["ideas","draft","lines"],
 "Repeated across a 37-track album this became the formula critics complained of; a song that simply takes the blame may land harder. This is a critics' reading and the analyst's, not a documented method.",
 "medium", "Unverified as intent; treat as a lens, not a Nashville rule.", ["C06","C31","C55"])

card("C26",
 "Attitude is wanted but the artist isn't a swaggering person.",
 "Write the attitude as a character the artist steps into, and give it one concrete scene to push against (a stranger at a bar, a party she had no business attending).",
 "Tate McRae says Greedy came from rapping ideas over a beat while sketching one scene, a man approaching her at a bar; she first thought it was the worst song she'd heard, and describes an alter ego who takes over on stage. ADÉLA says Nicole Kidman came from feeling like the actress in a corset at a Golden Globes party she felt she shouldn't be at. Noah Kahan sang the Stick Season chorus in a borrowed country twang to get outside himself.",
 ["PB-F12","AD-F4","ST-F12"], ["PB-S55","PB-S54","AD-S17","ST-S1"], "documented_statement",
 "The scene gives the swagger something to react to, so it reads as a moment rather than a pose.",
 ["attitude","swagger","persona","character","scene","hook","ideas"], ["pop","hiphop"], ["ideas","lines","draft"],
 "Because the persona is not how the artist talks, the voice can feel borrowed; McRae resisted it for months. Critics described Sports car mostly through comparisons to earlier pop, so a borrowed reference can overshadow the lyric.",
 "medium", "", ["C02","C33"])

card("C27",
 "'Be honest and direct' is producing a transcript of events, or an over-share.",
 "Directness means precision about the feeling, not a log of facts: name the emotion exactly and keep the facts loose enough for a listener to borrow. Keep other people's private details out.",
 "Rodrigo says mundane daily detail alone would be dull and the emotional core is what lands; her songs give a framework of emotions listeners fill with their own lives; she only registers how exposed a lyric is weeks before release. Benson Boone calls vulnerability the most important thing but never names or reveals private details about other people.",
 ["OR-F14","ST-F16"], ["OR-S22","OR-S9","OR-S5","ST-S15"], "documented_statement",
 "A precisely named feeling with portable facts is what lets a stranger adopt the song; a transcript makes them a spectator.",
 ["confession","specificity","vagueness","diary","verse","chorus"], ["pop","singer_songwriter"], ["ideas","lines","draft"],
 "ADÉLA's Therapy was cut from a 15-minute ramble over the beat and several critics called it the album's weakest, lyrics 'especially simple': unedited diary material needs a strong edit.",
 "medium", "", ["C22","C12"])

card("C28",
 "A confession keeps coming out as a flat declaration.",
 "Answer someone else's maxim: concede the principle in the first half of the line, then admit you can't live up to it.",
 "Rodrigo says the grudge's key line about forgiveness came at a red light as a counter-line to a Morrissey lyric about kindness: it agrees with him and then admits she can't do it. Nigro says they spent hours on that melody.",
 ["OR-F10"], ["OR-S13","OR-S35"], "documented_statement",
 "The concession earns the admission; the listener hears the narrator trying and failing rather than announcing a feeling.",
 ["confession","admission","grudge","forgiveness","hook","verse"], ["pop","singer_songwriter"], ["lines","ideas","edit"],
 "The Atlantic found the song maudlin and generic: a plain confession still needs a fresh frame around the concession.",
 "medium", "", ["C08","C29"])

card("C29",
 "The idea sits right next to a stock trope.",
 "Name the trope and deliberately turn it: reverse the idiom's emotional charge, or let the song become the thing it wasn't aiming at.",
 "Finneas says there are many songs about loving someone until death and he found it fun to reverse that on Birds of a Feather (the source doesn't spell out the reversal). Ray Fulcher says When It Rains It Pours flipped the idiom so a breakup starts a run of good luck. Amy Allen says Without Me was not written as an empowerment song and became one, and that songs written as empowerment songs come out cheesy or preachy.",
 ["PA-F11","CW-F8","AA-F10"], ["PA-S32","CW-S27","AA-S8"], "documented_statement",
 "The listener's expectation of the trope becomes part of the hook; the turn is felt because the original is already in their head.",
 ["trope_reversal","idiom_flip","concept","angle","hook","title"], ["pop","country","any"], ["ideas","lines"],
 "If the reversal is the only idea and the verses add nothing, the song reads as a novelty. A theme like empowerment comes out better as a result than as the goal.",
 "high", "", ["C30","C31"])

# ---------------- CONCEPTS, TOPICS AND HOOKS ----------------
card("C30",
 "There's a good title phrase but the song could go anywhere.",
 "A title with an everyday meaning is a concept, not yet an angle. List the angles the phrase allows and choose the one that turns the phrase against its usual sense; keep the feeling ordinary and make the wording new.",
 "Lori McKenna took Girl Crush from a social-media tag normally meaning admiration of another woman; Hillary Lindsey says it could have been an empowerment song and the angle (romantic jealousy) was chosen in the writing. Ryan Tedder describes a hook as a basic human concept phrased in a way nobody had said before.",
 ["CT-F15","CT-F16","CW-F8"], ["CT-S36","CT-S37","CT-S19","CW-S28"], "documented_statement",
 "Topic is what the song is about; angle is what this song says about it. Listeners remember the angle.",
 ["title","concept","angle","hook","ideas","idiom_flip"], ["any"], ["ideas","lines"],
 "A mandatory plot twist is a third thing: an angle can be a stance or a feeling with no twist at all. Amy Allen says she is bad at writing from a handed title and finds the song by talking with the artist.",
 "high", "", ["C29","C36","C38"])

card("C31",
 "A title that is ordinary time-language or an everyday phrase; can it mean two things?",
 "Use a phrase that already holds two readings (yesterday evening / the final night; get him back as reunion / revenge) and keep the verses from settling which one is true.",
 "Holler notes Last Night works as yesterday evening and as the final night together, and American Songwriter stresses the fight is never resolved. NPR's critic reads get him back! as both wanting the ex back and wanting revenge; the analyst notes the idiom already carries both and that critics describe different vocal registers for the two wants.",
 ["CW-F3","OR-F7"], ["CW-S46","CW-S45","OR-S6"], "observable_feature",
 "Each chorus asks the song's question again with the same words; the double reading does the work repetition would otherwise need.",
 ["double_meaning","title","chorus","unresolved","breakup"], ["country","pop"], ["ideas","lines","edit"],
 "The double reading only survives while the verses keep the outcome open; once the fight is resolved the second meaning goes dead. MusicOMH found get him back! flat: the device leans on a performer who can switch tone.",
 "medium", "No writer statement on either double meaning was found.", ["C25","C30"])

card("C32",
 "The title addresses someone; a name or an endearment?",
 "The address word sets the tone of the whole song: a name gives specificity and story; an endearment ('babe') can carry a sarcasm a name cannot. Choose by the tone, not by habit.",
 "Dan Nigro says Good Luck, Babe! was first Good Luck, Jane!; Roan wanted a real name and they argued, then switched to Babe because it felt more sarcastic and playful. The edit is one word inside the title.",
 ["PA-F6"], ["PA-S19","PA-S20","PA-S23"], "documented_statement",
 "An endearment aimed at someone the narrator is dismissing turns the title into a dig; a name would have made it a scene.",
 ["title","addressee","name","sarcasm","hook"], ["pop"], ["ideas","edit","lines"],
 "Nigro presents this as a tone choice for one song, not a rule against names; Abrams' I Love You, I'm Sorry and Hey Jane use direct address differently.",
 "high", "", ["C33","C06"])

card("C33",
 "Looking for a title in a lyric that has a setting word, a brand or a proper noun in it.",
 "Promote the oddest concrete noun to the title (a brand, a celebrity, a gadget), but only if it stands for one specific feeling the narrator borrows; if nobody in the room can say what feeling the noun stands for, it is only a novelty.",
 "Addison Rae says Backseat became Diet Pepsi when Charli XCX asked why it wasn't called that. ADÉLA sums up Nicole Kidman as being about feeling like Nicole, says Red Bottoms started from a worn-out shoe (the luxury name covering a run-down state) and that Hitachi came from a session joke that turned into a sad song about intimacy fading. The analyst notes at least five of PRIMA's eleven titles are loaded proper nouns.",
 ["PB-F11","AD-F4","AD-F1","AD-F3","AD-F15"], ["PB-S47","AD-S17","AD-S37","AD-S16"], "documented_statement",
 "A specific noun is more sayable and more memorable than a setting word, and the gap between the glamorous noun and the plain feeling is the hook.",
 ["title","proper_noun","brand","celebrity","object","hook","ideas"], ["pop"], ["ideas","edit"],
 "The Arts Desk warned a novelty title risks gimmickry and survives only if the song commits; NME called Nicole Kidman one of the album's few misses even as it went UK top 5. No source says the method is deliberate; it is a pattern across her accounts.",
 "medium", "", ["C32","C26"])

card("C34",
 "A hook phrase doesn't quite parse and the room wants to fix the grammar.",
 "Keep a slightly broken phrase when the persona is confident and playful and the central image is clear; the oddness is why people repeat it.",
 "Press relayed on Wikipedia reports a grammar writer and a linguist disagreeing over whether the Espresso chorus phrase parses, while Vulture called it an instant earworm; Julian Bunetta says the title came out of a 20-minute sung burst with no concept going in, followed by hours of word changes.",
 ["AA-F13","PA-F2","AA-F12"], ["AA-S17","PA-S3","AA-S10"], "observable_feature",
 "Listeners repeat and argue about a phrase that doesn't quite parse; delivered with total confidence it reads as attitude, not error.",
 ["hook","chorus","nonsense","attitude","grammar","title"], ["pop"], ["lines","ideas","edit"],
 "In a sincere ballad the same oddness reads as a mistake (analyst's inference). Nonsense needs a clear central image (caffeine as infatuation) or it is filler.",
 "medium", "Second-hand: the original Vulture and Them pieces were not opened.", ["C26","C36"])

card("C35",
 "Something someone just said in the room sounds like a title.",
 "Take the offhand remark and shift its tense or person until it confesses something; then it is a title.",
 "Chandler Walters recalls Charlie Handsome saying 'we're going to need some help' in a bar; shifted to past tense and first person it became I Had Some Help, an admission. Julia Michaels says a plain phrase she said mid-conversation became Love Is Weird after Billy Walsh flagged it. Carpenter already had the Please Please Please phrase from her week before the session existed.",
 ["CW-F4","CT-F11","AA-F1"], ["CW-S6","CW-S7","CT-S29","AA-S2"], "documented_statement",
 "A found phrase arrives with its own rhythm and sincerity; the tense shift turns banter into confession.",
 ["title","session_capture","hook","admission","conversational"], ["country","pop","any"], ["ideas","lines"],
 "The I Had Some Help write took about 24 minutes because the track and artist were fixed; that speed is no model for a song still searching for its subject.",
 "high", "", ["C01","C30"])

card("C36",
 "The hook is an unusual topic and still doesn't stick.",
 "Keep the feeling ordinary and make the phrasing new; the angle usually lives in the title's wording, not in an unusual subject. Short and repeatable beats clever.",
 "Ryan Tedder: a hook is a simple melody carrying a basic human concept phrased in a way nobody had said before (his example: an everyday feeling given new wording); he adds that current hits lean on rhythm, repetition and one phrase that captures the track, and that on Good Life the real hook is the post-hook.",
 ["CT-F16"], ["CT-S19"], "documented_statement",
 "The listener recognises the feeling instantly and remembers the wording because it is new.",
 ["hook","title","chorus","repetition","angle","ideas"], ["pop","any"], ["ideas","lines"],
 "'Fresh' does not mean never-discussed; a familiar topic with a distinctive wording is the common case in hits. Tedder's view is one hit-writer's; Hozier and Kahan build hooks from roll-calls and local terms instead.",
 "high", "", ["C30","C12"])

card("C37",
 "Writing another song to the same person, or a sequel of feeling.",
 "Reuse one title template across songs to the same person and change the single verb; the pair becomes an ongoing conversation.",
 "Gracie Abrams says I Love You, I'm Sorry takes its shape from her earlier I Miss You, I'm Sorry about the same person, after years of drafts using a hate version of the formula, and calls the new song a bookend.",
 ["PB-F3"], ["PB-S1","PB-S2"], "documented_statement",
 "Two flat clauses become a before-and-after; the changed verb shows how the relationship moved without exposition.",
 ["title","sequel","breakup","hook","catalog"], ["pop","singer_songwriter"], ["ideas"],
 "Depends on the earlier song being known; heard alone the title is two stock phrases. Gorley warns against writing Part Two of an artist's last hit: a sequel of feeling is not a sequel of concept.",
 "medium", "", ["C39"])

card("C38",
 "Where to start a co-write, and what to do when the artist rejects the chorus later.",
 "In a co-write for an artist, settle the chorus first; if the artist later says the chorus lyric is wrong, expect the concept to change rather than a word, and let the artist's ear for her own voice decide. Writing straight through from the first line is a deliberate alternative for a personal song.",
 "Amy Allen says she always starts with the chorus with artists and calls it the crux; weeks after the Greedy session Tate McRae said the chorus lyric was wrong and, in Allen's words, 'we' edited heavily and completely changed the concept. For her own 2024 album she wrote front to back on purpose. Emily Warren and Adam Yaron (Ordinary) also describe chorus-first.",
 ["AA-F5","AA-F6","CT-F6","PB-F15"], ["AA-S3","CT-S11","PB-S64"], "documented_statement",
 "Everything hangs off the chorus, so a late chorus change is a concept change; knowing that avoids patching.",
 ["co_write","chorus","concept","artist_voice","process"], ["pop"], ["ideas","draft","reply"],
 "Allen's own album shows she drops chorus-first when writing for herself. The Greedy rewrite is documented only as 'chorus lyric and concept changed'; no wording is available.",
 "high", "", ["C30","C43"])

card("C39",
 "The new idea mainly resembles the artist's last hit.",
 "Don't write Part Two of what they just put out. Keep the subject if you must, but change the stance (wry, accusing, sarcastic) or the angle.",
 "Ashley Gorley's advice to new writers is not to write a sequel to an artist's last release. Rodrigo and Nigro say deja vu and good 4 u were written to avoid another heartbreak ballad: same subject, different stance.",
 ["CW-F12","OR-F13"], ["CW-S20","OR-S18","OR-S9"], "documented_statement",
 "The listener gets the artist they know doing something they haven't heard, which is the only kind of familiarity that sells twice.",
 ["ideas","angle","stance","catalog","artist_voice"], ["any"], ["ideas"],
 "Reusing a familiar word is not reusing a concept (Gorley on Dirt On My Boots). Reaching fast for a contrasting genre can pull in recognisable melodic shapes: both Rodrigo songs later carried interpolation credits.",
 "high", "", ["C37","C30"])

card("C40",
 "A good title doesn't fit this singer.",
 "Before changing the title, find one sensory detail that puts the singer in physical contact with it (she drinks it, he tastes it when he kisses her).",
 "Josh Osborne held the title Sangria for months because it seemed like a woman's drink and only opened it by asking how a man could sing it believably. Gorley says the bridge of You're Gonna Miss This came from a repairman's offhand remark that really happened.",
 ["CW-F9"], ["CW-S24","CW-S23"], "documented_statement",
 "The detail makes the title true for this narrator, and the listener feels the physical fact before the metaphor.",
 ["title","detail","artist_voice","verse","ideas"], ["country","pop"], ["ideas","lines","edit"],
 "A detail reveals something only if it changes who the narrator is or what they want; a prop list is decoration.",
 "high", "", ["C11","C30"])

card("C41",
 "A song that defines itself against a place, a scene or a value system.",
 "Let the place name stand for the whole value system and define the narrator by refusal of it, moving from one specific person in verse one to a crowd in verse two; name at least one of the places the song is for, or the outsider stance goes generic.",
 "ADÉLA says Ain't In LA came from a photo of her mother at 18 in front of smuggled Western posters, from Lorde's Royals and Team, and from frustration at LA's beauty standards; press describes verse one as domestic detail and verse two widening to girls everywhere. Singles Jukebox critics split: too vague because LA is the only named place, versus a great chorus. Noah Kahan feared Vermont detail would alienate outsiders and found the specificity was what connected.",
 ["AD-F8","AD-F9","AD-F10","ST-F13"], ["AD-S18","AD-S13","AD-S36","ST-S3"], "documented_statement",
 "A refused place gives the narrator a stance without a story; the crowd in verse two turns a memory into an anthem.",
 ["place","stance","anthem","verse","specificity","outsider"], ["pop","singer_songwriter"], ["ideas","draft","lines"],
 "For a chart anthem the vagueness may be deliberate: it became her first Hot 100 entry. Critics' preference for named places is not the audience's. Some critics heard the Royals model as derivative.",
 "medium", "", ["C12","C11"])

# ---------------- SECTION AND WHOLE-SONG FUNCTION ----------------
card("C43",
 "Not sure what belongs in the chorus and what belongs in the verses.",
 "The chorus should tell the whole song in words anyone wants to sing; the verses (and sometimes the pre) carry the private specifics. Test: someone hearing only the chorus should be able to say what the song is about.",
 "Justin Tranter says the chorus should explain the whole song and be universal enough that everyone wants to sing it, while the verses uncover the details. Emily Warren passes on the saying that verses are for the writer and the chorus is for the audience.",
 ["CT-F13","CT-F14"], ["CT-S33","CT-S11","CT-S34"], "documented_statement",
 "The chorus becomes the thing people sing in the car; the verses are where they lean in.",
 ["chorus","verse","structure","specificity","draft"], ["pop","country","any"], ["draft","lines","edit"],
 "Switched On Pop's verse episode argues the chorus payoff depends on the verse setup, so a universal chorus still needs specific verses. Charli's Camera and Rodrigo's drivers license treat the chorus as a build, not the statement.",
 "high", "", ["C11","C47"])

card("C44",
 "The pre-chorus feels like padding, or the chorus arrives flat.",
 "Write the pre-chorus as a cliffhanger (an open question or rising pressure) that only the chorus answers; give each section its own range. If the chorus is weak, rewrite the pre first. If singing verse straight into chorus doesn't feel abrupt, the pre may be unnecessary.",
 "Emily Warren writes the pre-chorus lyric as a cliffhanger that leaves the listener needing the chorus, and puts verse lowest, pre higher and tenser, chorus highest. Gary Ewer says the pre is optional and gives the verse-into-chorus test. Rami Yacoub says a chorus that doesn't land may be a pre-chorus failing to set it up.",
 ["CT-F6","CT-F7","CT-F5"], ["CT-S11","CT-S12","CT-S13","CT-S10"], "documented_statement",
 "The listener arrives at the chorus needing it; without the pressure the same chorus feels like information.",
 ["pre_chorus","chorus","structure","draft","edit"], ["pop","any"], ["draft","lines","edit"],
 "Warren says the contrast matters more than the exact order of ranges. Tyler's DON'T TAP THE GLASS rule (no intros, outros, bridges) shows sections can be removed on purpose.",
 "high", "", ["C21","C45"])

card("C45",
 "Does this song need a bridge, and what should it do?",
 "Keep a bridge when it brings a new stance (doubt, defiance, the narrator's own admission, a reversal), set apart by a change of rhythm rather than more speed. If it only restates the chorus feeling over new chords, cut it.",
 "Gracie Abrams says most of her album's bridges rush as manic thought but on I Love You, I'm Sorry she wanted a rhythmic change, and the bridge is where she owns her behaviour as a habit to break. Roan wrote the Good Luck, Babe! bridge alone in about two minutes over looped pre-chorus chords once the chorus's claim was settled. Switched On Pop frames the bridge as a contrast that at its best changes the song's meaning. Tyler set a rule of no bridges for a whole album.",
 ["PB-F2","PA-F9","CT-F18","ST-F11"], ["PB-S1","PA-S20","CT-S41","ST-S44"], "documented_statement",
 "A bridge that changes the stance makes the last chorus mean something new; one that restates makes the song longer.",
 ["bridge","structure","admission","last_chorus","draft"], ["pop","any"], ["draft","lines"],
 "Roan's two-minute bridge came after a year of work on the song; not evidence that bridges should be fast. The Switched On Pop framing is the show's, not a writer's documented reasoning.",
 "medium", "", ["C46","C19"])

card("C46",
 "A verse or a chorus has been rejected but something in it is good.",
 "Try the rejected verse as the bridge before deleting it. If a chorus is thrown out, keep its one good image for the outro or a later section.",
 "Nigro says Rodrigo disliked the original get him back! verse; weeks later he moved it into the bridge, where it worked. Rodrigo threw out the first chorus of the cure but kept one image (unravelling), which became the outro and a theme across the album.",
 ["OR-F5","OR-F2"], ["OR-S3","OR-S2"], "documented_statement",
 "Material that was wrong for its slot can be right for the slot that needs contrast; the song keeps its best image without keeping its weakest section.",
 ["bridge","outro","cut_lines","edit","structure"], ["pop","any"], ["edit","draft","lines"],
 "Only works if the rejected section was good material in the wrong place; a bad verse does not become a good bridge by moving.",
 "high", "", ["C45","C08"])

card("C47",
 "The chorus is plain and the song needs a payoff.",
 "Withhold an expected arrival (the drums, the full-voice note, the whole title) past the first chorus so the last return of the plain lyric feels earned; or treat the chorus as a build and hold the biggest statement for the bridge.",
 "Rodrigo says the cure holds back the drums where the listener expects them so the payoff must be earned, and the outro climbs to a final scream. Nigro says drivers license has no real chorus: a minimal verse and chorus building to a maximal bridge, which became the emotional centrepiece.",
 ["OR-F3","OR-F12"], ["OR-S2","OR-S8","OR-S7"], "documented_statement",
 "Delayed arrival turns repetition into release; the plain line lands because the listener has waited for it.",
 ["last_chorus","bridge","chorus","structure","outro","escalation"], ["pop","singer_songwriter"], ["draft","lines"],
 "Delaying the payoff lengthens the song and only works if the first half holds attention without it. With a weak bridge, a chorus-as-build song has no chorus to fall back on. The app can suggest the shape; it cannot hear whether the arrangement delivers it.",
 "high", "", ["C43","C50"])

card("C48",
 "A short, hook-led song where the hook is the whole proposition.",
 "Open on the chorus and vary the chorus (a second chorus stanza where the bridge would go) instead of writing a bridge; keep the song short.",
 "Hit Songs Deconstructed's public summary gives Last Night as chorus first, no pre-chorus, a post-chorus, and an unusual second chorus stanza where a bridge would usually go, running 2:39. Charlie Handsome says it was written to an eight-bar voice-note loop.",
 ["CW-F2","CW-F1"], ["CW-S47","CW-S5"], "observable_feature",
 "The listener gets the hook before anything else and never leaves it; the variation keeps repetition from going dead.",
 ["chorus","structure","hook","short_song","bridge"], ["country","pop"], ["draft"],
 "If the song needs a late change of perspective (a confession, a reveal), cutting the bridge removes the natural place for it. Handsome admits a hit-level hook can carry weak verses, so check the verses on their own.",
 "medium", "Structural summary is from a published analysis, not from listening.", ["C45","C53"])

card("C49",
 "The attitude is on the page but won't come through sung.",
 "Give the attitude a spoken element: an interjection at the top (a breath, an eye roll), spoken verses under a sung chorus, a friend's banter between sections, or a whispered chorus. Then keep the sung lines sincere.",
 "Carpenter describes the spoken opener of Manchild as a breath and an eye roll at herself before the story. Rodrigo's bad idea right? is described as almost entirely spoken with a sung pre-chorus. Langley modelled her verses on spoken 'talking country' and refused the label's request to sing them. ADÉLA brings a friend's real banter into Boys. McRae's Sports car has a whispered chorus (per critics).",
 ["PA-F4","OR-F6","CW-F10","AD-F11","PB-F13"], ["PA-S12","OR-S10","OR-S12","CW-S29","AD-S16","PB-S57"], "documented_statement",
 "Spoken delivery carries sarcasm and fondness that a sung line makes too earnest; the sung parts then carry the feeling.",
 ["spoken","delivery","attitude","opening","verse","chorus","dialogue"], ["pop","country","hiphop"], ["draft","lines","ideas"],
 "On paper a spoken interjection carries almost nothing; the effect is entirely in delivery. A solemn lyric spoken over a groove sounds like recitation. The Arts Desk found Boys too minimal to convey its carelessness.",
 "medium", "", ["C24","C14"])

card("C50",
 "An escalating song sounds like three songs stuck together; or the last chorus needs a lift.",
 "Write the transitions as their own job. For the last chorus, get the lift from harmony, texture or register rather than new words; after a dense passage give the listener long notes.",
 "Nigro says management's reaction to vampire was that it sounded like three songs in one, so they reworked the transitions; Rodrigo wanted it to crescendo the whole time. Kahan got his final-chorus lift from gang vocals and harmonies rather than new words (and the literal staging was judged a bit corny). Martin says a busy section needs a sparse one after it. Atwood describes Messy raising the anger section by section without new information.",
 ["OR-F4","ST-F14","CT-F8","PB-F8"], ["OR-S3","OR-S15","ST-S1","CT-S14","PB-S19"], "documented_statement",
 "The listener feels one rising line rather than three starts; the lift arrives without the lyric having to shout.",
 ["escalation","transitions","last_chorus","structure","density","draft"], ["pop","any"], ["draft","lines"],
 "Escalation does not rescue a literal central metaphor (Pitchfork on vampire's on-the-nose chorus imagery). The app cannot hear texture; it can only avoid rewriting words that don't need it.",
 "medium", "", ["C47","C13"])

card("C51",
 "A song built from portraits of other people.",
 "Make each verse a portrait with the same closing address, so the chorus works as a verdict, and save the narrator for the final portrait so the verdict turns on him.",
 "Press describes Take Your Mask Off as three verses (a posing drama student, a closeted priest, a housewife) each ending with the hope that they drop the mask, and a last verse turning the charge on Tyler himself, which Complex calls the album's cornerstone.",
 ["ST-F9"], ["ST-S37","ST-S38"], "observable_feature",
 "The repeated address turns the chorus from a sermon into a mirror once the narrator is inside it.",
 ["character","portrait","verse","structure","self_mockery","message_song"], ["hiphop","any"], ["draft","ideas"],
 "Slant calls the song's take on its characters simplistic and patronising: sketches that exist only to deliver a moral read as lecture. Pair with C52.",
 "medium", "", ["C52","C24"])

card("C52",
 "A message or protest song is starting to preach.",
 "Swap the argument for concrete names or examples (a roll-call) and let the chorus stop explaining; the listener draws the conclusion.",
 "Hozier says the Nina Cried Power verses sat for a long time while he worried the song was too soap-boxy; the chorus came together once he decided to name artists who had stood up for causes, a roll-call rather than an argument.",
 ["ST-F15"], ["ST-S6"], "documented_statement",
 "Names and examples are evidence; an argument is an opinion. Evidence lets the listener agree on their own.",
 ["message_song","chorus","specificity","detail"], ["singer_songwriter","any"], ["lines","draft","ideas"],
 "A protest song by one writer; says little about playful or romantic material. A roll-call of unknown names is just a list.",
 "high", "", ["C51","C11"])

card("C53",
 "Writing to a loop that already sounds finished.",
 "Test the hook first, then check the verses on their own, because the loop will carry a weak verse; get section contrast from rhythm, lyric density and dynamics rather than new chords.",
 "Charlie Handsome says he aims to make beats that already sound like hits, and concedes that a hit-level hook lets weak verses get by. McDaid says the Shape of You loop barely changed, so sections were differentiated through dynamics, lyric and rhythm. Sheeran fires melodies at once; McDaid guards the few precious ones.",
 ["CW-F1","ST-F1","ST-F2"], ["CW-S5","CW-S3","ST-S30","ST-S29"], "documented_statement",
 "The groove sells the hook on first listen; the verses are what the listener judges on the tenth.",
 ["loop","hook","verse","structure","session_capture","rhythm"], ["pop","country","dance"], ["lines","draft","edit"],
 "Loop-first suits short groove songs; a story song whose payoff sits in the verses shouldn't start this way. Rhythm-first syllables can leave words that only fit the groove (see C17's meaning check).",
 "high", "", ["C17","C48"])

card("C54",
 "A stream-of-consciousness confession, recorded or typed in one go.",
 "A long unfiltered ramble over the beat can find lines a sectioned draft would never produce; then it needs a hard edit that keeps one unexpected image per section, or it reads as diary.",
 "ADÉLA says Therapy's first take was about 15 minutes of talking over the beat with her voice almost gone, cut to three minutes; several reviewers found it the album's weakest track (lyrics 'especially simple', 'a slog'). Charli XCX kept Camera's stream-of-consciousness feel on purpose and dropped rhyme to protect it; critics praised that one.",
 ["AD-F6","AD-F13","PB-F10"], ["AD-S20","AD-S47","AD-S44","PB-S41"], "documented_statement",
 "The ramble finds the real sentence; the edit decides whether the listener hears a thought or a mood.",
 ["interior_monologue","confession","cut_lines","diary","edit"], ["pop"], ["edit","draft"],
 "Two documented cases with opposite receptions: the method is only as good as the edit. Don't recommend it as a default.",
 "low", "", ["C09","C27"])

card("C55",
 "Is this a craft move or a genre habit? (Nashville room vs general craft)",
 "Borrow the room's methods without its default vocabulary or persona: flip the idiom, find the detail that makes the title true for the singer, sing-test the title, cull the 'B' song. Let a stock genre image in only if the story can't be told without it or it becomes the song's metaphor.",
 "Shane McAnally agreed 'formulaic' was the right word for bro-country, said everyone including him writes it, and will only reluctantly put someone in a truck. Lainey Wilson's Heart Like a Truck rewrote the truck into a metaphor for a battered self after a rockier draft felt dishonest. Paste and Saving Country Music found I'm the Problem formulaic for recurring whiskey, drives and exes. The analyst's sort: idiom flips, revealing detail, sing-tests and culls look like general craft; drinking/truck/small-town vocabulary, talking-country verses and the blame-trading persona are genre; beat-first quick writes and long credit lists are industry effects.",
 ["CW-F11","CW-F14","CW-F15","CW-F12","CW-F13"], ["CW-S26","CW-S51","CW-S19","CW-S18","CW-S20","CW-S36"], "analytical_inference",
 "The transferable techniques travel to pop and hip-hop; the imagery and persona drag country in with them.",
 ["genre","country","convention","imagery","cliche","ideas"], ["country","pop"], ["ideas","lines","draft"],
 "Several 'general' techniques are documented mainly from country writers, so how well they transfer is untested. Critics' judgements of novelty are not judgements of appeal: nearly all 37 tracks reached the Hot 100.",
 "medium", "Transfer of these techniques outside country is asserted, not tested.", ["C11","C25","C29"])

card("C59",
 "A first explicit or sexual song that still has to sound like this artist.",
 "Use a deniable object metaphor that works on two levels, keep some story, and cast the narrator as the one looking rather than the one looked at.",
 "Tate McRae says Sports car was her first song about sex, that she kept metaphor and story so it still felt like her, that a listener could hear it as being only about a car, and that she casts herself as the car on display who gets to look first.",
 ["PB-F13"], ["PB-S58","PB-S59"], "documented_statement",
 "The listener chooses which level to hear; the metaphor protects the artist's voice while the delivery supplies the heat.",
 ["sex","desire","metaphor","double_meaning","persona","attitude"], ["pop"], ["ideas","lines"],
 "Critics described the song mainly through comparisons to earlier pop, so the borrowed reference overshadowed the lyric; the metaphor must be the artist's own object, not the genre's.",
 "medium", "", ["C26","C31"])

card("C60",
 "The writer is embarrassed by a simple, sincere chorus and wants to cut it.",
 "A writer's embarrassment at a plain sincere line is not a reliable signal of its worth; keep it in the draft and test it cold, as with the 'too far' line in C03.",
 "Eilish wanted to cut Birds of a Feather several times and told the label it was a bit stupid; it became the year's most-streamed song. McRae thought Greedy was the worst song she'd heard and Tedder pushed for months. Allen says she was taught that too-personal lyrics lose listeners and that Carpenter's key changes prove the listener can follow.",
 ["PA-F12","PB-F12","AA-F9"], ["PA-S30","PB-S55","AA-S7"], "documented_statement",
 "The plain sincere line is often the one the writer is too close to judge; the audience isn't.",
 ["plainness","chorus","cut_lines","devotion","confidence"], ["pop"], ["edit","lines","reply"],
 "One hit does not mean every doubted song should be kept; the report on Birds of a Feather doesn't say whether the trouble was words or delivery.",
 "medium", "", ["C03","C12"])

card("C61",
 "A line has to get from one thing to the next (a verse line before the chorus, a join between two images) and every draft is trying to be a highlight.",
 "Write the connective line to be invisible: plain, short, in the narrator's ordinary voice, carrying one fact or one small shift of time. It should not introduce a second image, pre-empt the chorus or tell the listener how to feel.",
 "Justin Tranter and Emily Warren split the song into a universal chorus and specific verses; Max Martin says a dense passage needs a sparse one after it so the listener can take it in. The analyst's extension: a verse made only of highlights has no place for the chorus to land, and a 'brilliant' connective line steals the chorus's surprise (see the original pair E15).",
 ["CT-F13","CT-F6","CT-F8"], ["CT-S33","CT-S11","CT-S14"], "analytical_inference",
 "The listener arrives at the chorus with attention to spend; the plain line makes the next line feel bigger.",
 ["structure","transitions","connective","verse","chorus","plainness","density"], ["any"], ["lines","edit","draft"],
 "A song with no highlights in the verses is dull; the point is rationing, not banning. In a fast rhythmic section every line may need to be a picture (C13).",
 "medium", "No writer describes 'connective lines' in these words; the principle is assembled from chorus/verse statements and Martin's density remark.", ["C43","C13","C47"])

with open('pack/cards.jsonl','w') as f:
    for c in C:
        f.write(json.dumps(c, ensure_ascii=False)+'\n')
print(len(C), 'cards written')
