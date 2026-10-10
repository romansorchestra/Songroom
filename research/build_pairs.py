# Builds research/pack/pairs.jsonl. Every pair is ORIGINAL and SYNTHETIC, written for this collection.
# None is an artist's draft and none rewrites a known lyric. Analyst views are provisional; sam_judgment stays null
# until Sam supplies one. Run: python3 -I build_pairs.py
import json
E = []
def pair(id, brief, context, constraints, a, b, tradeoff, view, conf, links, use="development", kind="lines"):
    E.append(dict(id=id, version=1, original=True, kind=kind, brief=brief, context=context, constraints=constraints,
                  a=a, b=b, tradeoff=tradeoff, analyst_view=view, analyst_confidence=conf, sam_judgment=None,
                  links=links, use=use))

pair("E01",
 "Natural speech versus rhyme-driven inversion. Two-line verse opener; she saw her ex at a party and pretended it was nothing.",
 "Pop, second person, mid-tempo. Nothing has been established yet; this is line 1-2 of verse 1.",
 {"lines": 2, "rhyme": "line 2 ends on 'fine' or a slant of it", "syllables": "about 7-8 each"},
 ["I saw you and my friends were kind", "I smiled and said that I was fine"],
 ["I saw you first, so I had time", "to practise looking fine"],
 "A's first line exists to deliver the rhyme: 'my friends were kind' is a clause no one would say about that moment and it tells us nothing. B's rhyme (time/fine) is a slant that falls out of what she was actually doing, and 'practise looking fine' implies the hurt without stating it; it also gives line 3 somewhere to go (what she practised, what it cost).",
 "B. A is not absurd, which is the point: it is the kind of line that gets accepted because it rhymes.", "high", ["C10", "C01", "C15"])

pair("E02",
 "A meaningful detail versus an ornamental detail. Two lines in verse 2; he is noticing the house has changed since she stopped expecting him home.",
 "Country-leaning, male narrator, first person. The chorus (already written) is his realisation; the verse should show it through behaviour, not explain it.",
 {"lines": 2, "content": "must show that she stopped expecting him and that he was slow to notice", "no": "no explaining the feeling"},
 ["The coffee pot still steams at dawn", "the kitchen's painted morning gold"],
 ["She stopped setting out two cups", "a month or so before I noticed"],
 "A is pleasant and sayable but decorative: it paints the room and changes nothing we know about him. B's detail does two jobs at once: she stopped (the expectation ended) and he didn't notice for a month (his absence is the real subject). B is plainer on the page and stronger in the song.",
 "B. A would be acceptable as atmosphere in a pre-chorus of a different song, which is why it is tempting here.", "high", ["C11", "C40", "C14"])

pair("E03",
 "A direct hook versus an overexplained premise. First two lines of a chorus; she is done playing the easy-going girlfriend.",
 "Contemporary pop, attitude-led, female narrator. The chorus should be singable on first hearing.",
 {"lines": 2, "role": "chorus opener", "must": "carry a stance, not a story"},
 ["I used to act like it was fine whenever you forgot", "now I'm learning that the version you liked was never really me"],
 ["I'm done being the chill one", "I don't think I ever was"],
 "A explains the premise a listener could have inferred and runs too long to sing back. B states the stance in a phrase a person would say, and the second line is the admission that makes it a song rather than a slogan. B also leaves the verses something to do (the evidence); A has already used it up.",
 "B. A's content is right; it belongs in a verse, unpacked over four lines, not compressed into the hook.", "high", ["C36", "C43", "C13"])

pair("E04",
 "A quiet setup versus an unnecessary punchline. Last lines of verse 1 before the chorus; the narrator is in his late father's house.",
 "Ballad, singer-songwriter, sincere. The chorus that follows is the emotional statement; the verse must hand over to it.",
 {"lines": 3, "role": "lead-in to chorus"},
 ["Dad's chair still faces the TV", "like it's waiting for the game to end", "guess he finally found a seat that doesn't hurt his back"],
 ["Dad's chair still faces the TV", "nobody's moved it", "nobody will"],
 "A's joke is a real joke and in a Carpenter-style song (sincere line, then the undercut) it could sharpen the hurt. Here it spends the moment the chorus needs and makes the narrator sound like he is managing the listener. B's third line is the smallest possible escalation (moved / will) and leaves the air still for the chorus.",
 "B for this brief. A is 'good but wrong here'; in a song whose narrator jokes to survive, A becomes the right answer.", "high", ["C05", "C47", "C45"])

pair("E05",
 "A familiar expression used purposefully versus an empty stock phrase. Two chorus lines about a friend who keeps going back to the same man.",
 "Pop, addressed to the friend, exasperated but loving.",
 {"lines": 2, "role": "chorus"},
 ["You've got a heart of gold and he's playing with fire", "you deserve so much more than a liar"],
 ["You keep saying this time's different", "it's different every time"],
 "A strings three stock phrases that cancel each other out; nothing in it is this friend or this man. B uses a phrase people actually say ('this time's different') and turns it: it is different, each time worse. The familiarity is the point, because the friend has heard herself say it.",
 "B. Common words are not the problem in A; the problem is that none of them were chosen.", "high", ["C29", "C31", "C30"])

pair("E06",
 "A line that reads beautifully versus one that sings more comfortably. The final line of a chorus, held on the last word, melody rising into it.",
 "Pop ballad. Meaning: she is still awake thinking about him. Text-only: the phonetic notes below are provisional.",
 {"lines": 1, "held_note": "last word is held", "meaning": "still awake, still him"},
 ["the night unspools its silver thread"],
 ["I'm still up, and it's still you"],
 "A is the better sentence on the page and the worse line to sing: the held word ends in a consonant cluster on a short vowel, the image needs a second to parse, and the listener gets no 'you' to hang the feeling on. B puts an open vowel on the held note, repeats 'still' so the rhythm carries the obsession, and ends on the person. (Provisional: nothing here was checked by singing.)",
 "B for a sung chorus. A could live in a verse delivered quietly, where the listener has time.", "medium", ["C18", "C17", "C13"])

pair("E07",
 "A distinctive emotional stance versus generic vulnerability. Two verse lines; she admits she looks at his new girlfriend's photos.",
 "Pop, confessional, slightly comic. The narrator should stay a little petty, not be moralised into health.",
 {"lines": 2, "role": "verse", "must": "admit the checking without saying 'I'm not over you'"},
 ["I'm so broken and I'm scared to feel", "I'm not okay but I'm trying to heal"],
 ["I know her coffee order now", "I've never met her"],
 "A could be sung by anyone about anything; it names feelings in words that have stopped meaning them. B is a stance: petty, specific, self-implicating, and funny because it is true. The second line is a plain fact that does the work a paragraph of vulnerability was trying to do.",
 "B. If the brief were a sincere piano ballad for a different artist, A's content would still need B's method: one checkable fact instead of a diagnosis.", "high", ["C04", "C06", "C11"])

pair("E08",
 "A rhythmically interesting fragment versus a complete sentence that drags. A hook for a rhythm-led, attitude-heavy song about a man who is broke but acts rich.",
 "Pop with hip-hop phrasing, female narrator, mocking. Short syllables, room for internal rhyme.",
 {"lines": 2, "role": "hook", "must": "repeatable, rhythmic"},
 ["He's always telling everybody that he's got money when he doesn't have any"],
 ["Big talk, small change", "same shoes, new name"],
 "A is correct and unsingable: one long sentence with no stressed landing places. B is four two-syllable units with an internal rhyme and a pattern (big/small, same/new) the listener can predict and enjoy. B also says more: 'same shoes, new name' is his whole biography.",
 "B. In a narrative verse A's shape (a full sentence) would be right; a hook needs units.", "high", ["C13", "C17", "C36"])

pair("E09",
 "The same line in two contexts. The line: 'I didn't even cry.'",
 "Context 1: last line of the bridge in a breakup song whose verses have shown her crying in the car, the lift, the shop. Context 2: opening line of verse 1 in a song about a funeral, with nothing established yet.",
 {"lines": 1},
 ["Context 1 — bridge close after two verses of crying: I didn't even cry"],
 ["Context 2 — verse 1, line 1, nothing established: I didn't even cry"],
 "In context 1 the line is a lie the listener can see through, so it lands as the song's saddest moment: the plainness is earned by everything before it. In context 2 the same words are a flat report; the listener has no reason to doubt her, so the line reads as cold or merely informational. Same line, same syllables, opposite value.",
 "Works in 1, fails in 2. This is the case for judging a line by what the song has already built, not by the line alone.", "high", ["C47", "C22", "C08"])

pair("E10",
 "An unresolved pair where both are valid. Two-line chorus ending on the exact words 'too late'; he realises he learned the lesson after she was gone.",
 "Country-pop, male narrator, rueful rather than devastated.",
 {"lines": 2, "ends_with": "too late", "no": "no 'leaving', no 'goodbye'"},
 ["I learned to say it right", "about a year too late"],
 ["I know the words by heart now", "I only learned them too late"],
 "A is wry and specific ('about a year' is a man measuring his own slowness) and sings short. B is sadder and more direct; 'by heart' quietly carries the love, and 'only' puts the blame on him. A suits a song that keeps its humour; B suits one that lets him be sorry out loud. Neither is wrong, and a room could argue either way.",
 "Both; depends on whether the song's narrator jokes or doesn't. Logged as unresolved on purpose.", "medium", ["C31", "C25", "C35"])

pair("E11",
 "Rhyme discovered within the thought versus rhyme imposed on it (edit task). Replace line 1 only; line 2 is fixed and the rhyme with 'call' must survive.",
 "Pop, she waited for him to call. Fixed second line: 'and told myself you'd call'.",
 {"lines": 1, "fixed_line_2": "and told myself you'd call", "rhyme": "with 'call', slant acceptable", "rhythm": "about the same as line 2"},
 ["I watched the shadows crawl"],
 ["I kept my ringer on"],
 "A rhymes perfectly and says nothing a person would say; 'shadows crawl' is there for 'call'. B is a slant (on/call) found inside what she actually did, and the behaviour is the feeling: a phone kept loud all night. B also lets a later line pay it off (what she did when it finally rang).",
 "B. If this were a crowd-shout chorus rather than a verse, the perfect rhyme might earn its decoration; here it doesn't.", "high", ["C10", "C11", "C15"], use="evaluation")

pair("E12",
 "Self-implication versus pure accusation. Second line of a chorus couplet; she is furious he treats the new girl better.",
 "Pop, attitude plus hurt. Line 1 is fixed: 'You never did that for me'.",
 {"lines": 1, "fixed_line_1": "You never did that for me", "must": "end the couplet"},
 ["you never even tried"],
 ["I never asked you to"],
 "A keeps the knife pointed outward and is the right line for a pure diss. B turns it: the admission that she never asked is more painful and more interesting, and it gives the bridge somewhere to go (why she never asked). B risks letting him off; A risks a song that only complains.",
 "Leans B, but A is correct if the brief is a straight diss. Context-dependent.", "medium", ["C06", "C25", "C04"])

pair("E13",
 "Plain and portable versus specific and particular. A devotional chorus line; the brief does not say whether it should work at weddings.",
 "Pop or singer-songwriter, sincere.",
 {"lines": 2, "role": "chorus"},
 ["I'd pick you every time", "in every kind of weather"],
 ["I'd pick you with the sink full", "and the bins not out"],
 "A travels: any couple can sing it at any occasion, which is also why a critic would call it generic. B is this couple in this kitchen, tender because it is unglamorous, and it will never be a first-dance song. Neither is a mistake; they are different products.",
 "Both; decide on purpose. A for a brief that wants portability; B for one that wants a face.", "medium", ["C12", "C11", "C43"])

pair("E14",
 "Spoken interjection versus sung statement as an opener. First line of a song about an exhausting boyfriend.",
 "Contemporary pop, attitude, female narrator. The delivery is part of the writing.",
 {"lines": 2, "role": "opening"},
 ["I can't believe I'm doing this again"],
 ["(sigh) Okay. So.", "He texted 'u up' at noon"],
 "A is sung and states the feeling; it works but arrives with nothing attached. B's spoken breath sets fond exasperation before any fact, and the fact that follows is small, checkable and funny (noon). On the page B looks like almost nothing; sung, it is a character.",
 "B for an attitude song; A for a sincere one. Note for the app: spoken openers carry nothing in text, so present them with a delivery cue.", "medium", ["C49", "C14", "C11"])

pair("E15",
 "A connective line that does its job versus a clever line that competes. Line 3 of a verse; it must get from 'she left in June' (line 2) to the chorus, which begins 'I still set two alarms'.",
 "Mid-tempo, male narrator, understated. The chorus is the surprise; the verse must not pre-empt it.",
 {"lines": 1, "role": "connective", "next": "chorus starts 'I still set two alarms'"},
 ["the calendar's a crime scene now"],
 ["It's been a while. I'm doing fine."],
 "A is the better line in isolation and the wrong one here: it is a second image competing with the chorus and it tells the listener how to feel before the chorus shows them. B is deliberately ordinary ('I'm doing fine') so that 'I still set two alarms' can contradict it. Connective lines should be invisible; a song full of A-lines is exhausting.",
 "B. The quality of A is exactly what makes it a bad connective line.", "high", ["C61", "C43", "C13"])

pair("E16",
 "Concept versus angle (ideas task). Topic given: jealousy of a partner's ex.",
 "Any genre. The output is a one-sentence concept, not lines.",
 {"kind": "concept", "sentences": 1},
 ["A song about being jealous of your partner's ex: she is prettier, cooler and everyone liked her."],
 ["I'm not jealous of her; I'm jealous of who you were when you were with her."],
 "A is a topic restated; any writer could have produced it and it generates nothing. B is an angle: it tells you what this song says about jealousy, it implies the verses (the versions of him she has heard about) and the chorus (the plain sentence itself). B is also a line a person would say in a kitchen at 1am.",
 "B. Most 'concept' failures are A: the topic with adjectives attached.", "high", ["C30", "C36", "C39"], kind="ideas")

with open('pack/pairs.jsonl', 'w') as f:
    for e in E:
        f.write(json.dumps(e, ensure_ascii=False) + '\n')
print(len(E), 'pairs written')
