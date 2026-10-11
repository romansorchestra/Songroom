# Song subject classification (one JSON object per line)

Fields:
- id: copy from input
- artist, title: copy from input
- known: "yes" (you know the song), "looked_up" (you checked it on the web), "unknown" (could not establish; still guess the other fields only if the title/artist make it obvious, else use "other")
- subject: ONE of
  romantic_love      (in love, devotion, falling for someone, happy together)
  desire             (attraction, lust, sex, a hookup, flirting)
  breakup_heartbreak (it ended: missing them, getting over them, bitterness after)
  relationship_trouble (still in it or half in it: cheating, jealousy, toxic, situationship, mixed signals, can't leave)
  longing_unrequited (wanting someone you don't have / can't have / never had)
  self_confidence    (self-worth, empowerment, glow-up, "I'm the one")
  flex_money_status  (wealth, success, rivals, street credibility)
  party_nightlife    (going out, dancing, drinking for fun)
  struggle_inner     (loneliness, mental health, addiction, pain, self-doubt, grief)
  nostalgia_hometown (youth, small town, growing up, the past)
  family_friends     (parents, kids, friendship)
  lifestyle_place    (country living, trucks, a way of life, a place)
  faith_spiritual
  social_political
  story_character    (a narrative about someone else / a character)
  other
- secondary: another value from the same list, or null
- relationship: true if the song is centrally about a romantic/sexual relationship or a specific romantic person (past, present or wanted), else false
- situation: a short plain-English phrase, <= 12 words, of the song's actual situation, e.g. "still sleeping with an ex she says she's over". YOUR OWN WORDS. Never quote or paraphrase a lyric line.
- perspective: one of "I_to_you" (sung to the other person), "I_about_them", "I_about_me", "story_third_person", "we"
- genre: pop | hiphop | country | rnb | latin | rock_alt | kpop | dance | other
- explicitness: clean | suggestive | explicit
- title_device: plain_phrase (an everyday thing people say) | metaphor_image | name_or_brand | place | number_or_date | other
- concept_scale: everyday (a common, relatable situation told plainly) | twisted_everyday (a common situation with one clever angle) | high_concept (built around an unusual premise, conceit or extended metaphor)

Rules: never write lyrics, quotes or near-quotes. One line of JSON per song, all songs, in input order.
