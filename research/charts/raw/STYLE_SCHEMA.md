# Lyric-style rubric (one JSON object per line). YOUR OWN WORDS ONLY — never quote, paraphrase or reconstruct a lyric line anywhere.

Copy: id, artist, title.
- known: "yes" | "looked_up" | "unknown"  (if unknown, still fill what the title/artist make obvious; otherwise use "unclear"/0)
- subject: one of desire | relationship_trouble | breakup_heartbreak | romantic_love | longing_unrequited | self_confidence | party_nightlife | struggle_inner | flex_money_status | nostalgia_hometown | family_friends | lifestyle_place | faith_spiritual | social_political | story_character | other
- relationship: true if centrally about a romantic/sexual relationship or a specific romantic person
- address: "to_you" (sung to the other person) | "about_me" | "about_them" | "we" | "third_person"
- register: the dominant way the words work —
  "conversational" (sentences someone would actually say out loud or text; plain diction; the song sounds like talking to a person)
  "imagistic" (built from images, metaphor, scene-painting; poetic diction)
  "anthemic" (slogan/chant hook; big simple declaratives built for a crowd)
  "narrative" (a story told in order, with scenes)
  "mixed"
- devices: array, any of: specific_mundane_detail (a named everyday object/place/moment), self_aware_aside (she comments on or undercuts herself), direct_accusation (tells "you" what you did), rhetorical_question, therapy_vocabulary (words from therapy/self-help: boundaries, healing, trauma, toxic, closure, growth…), internet_or_text_diction (texting/online register, slang of the moment), names_brands_places (real names, brands, places), aphorism (a standalone quotable line that would work as a caption), run_on_talky_lines (long, breathless, speech-like lines), bridge_is_the_climax (the bridge is the emotional peak / the fan moment), humour, profanity, repetition_hook (the title repeated as the hook), twist_ending (the meaning turns by the end)
- instapoet: 0–3 — how much the lyric resembles popular Instagram poetry (short plain declaratives; second person; caption-ready aphorisms; lowercase/informal feel; self-worth/healing framing). 0 = not at all, 3 = strongly.
- angst: 0–3 — intensity of relationship drama/anguish (0 none, 1 mild, 2 clear, 3 high).
- tone: one of sad | angry | wry | tender | horny | defiant | nostalgic | anxious | joyful | bitter
- explicitness: clean | suggestive | explicit
- situation: ≤12 words, your own words, the actual situation of the song.

Every item in input order, valid JSON per line.
