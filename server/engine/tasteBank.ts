// The taste test's cards (18 Oct 2026). Sam: "I don't love the way that I have to enter all
// that information on the settings. It's putting me off doing it. Can you design a more
// intuitive and clever way to test my taste and my level of judgment?"
//
// Two kinds of card, all original writing (never a line from a real song):
// - a PAIR: two titles, two choruses or two song ideas that differ in ONE named way (the
//   axis). The poles are hidden from him and shown to the writer with his pick, so every tap
//   says one precise thing. Both sides are meant to be usable; most are close calls.
// - a FLAW: a two-line chorus with one weakness planted (a forced rhyme, a cliché, a slip),
//   or a clean control with nothing planted. He taps the word that bugs him or says it's
//   fine. Caught / let through / found something else is his judgment; what he finds that
//   wasn't planted is his own red flag, the strongest thing the test can learn.
//
// Titles here must not be the title of a charted song (tests/taste.test.ts checks
// research/charts/classified.json). Add cards freely; never edit one that has been answered
// (answers point at the id), retire it with `retired: true` instead.

export type PairCard = {
  id: string; kind: 'pair'; what: 'title' | 'chorus' | 'idea'; axis: string;
  a: { text: string; pole: string }; b: { text: string; pole: string }; retired?: boolean;
};
export type FlawCard = {
  id: string; kind: 'flaw'; lines: [string, string];
  /** The planted weakness: an exact substring of one line, or null for a clean control. */
  planted: { line: 0 | 1; text: string; flaw: string; note: string } | null; retired?: boolean;
};
export type TasteCard = PairCard | FlawCard;

export const BANK: TasteCard[] = [
  // ---------------------------------------------------------------- titles
  { id: 't01', kind: 'pair', what: 'title', axis: 'conversational vs literary',
    a: { text: "Don't Make Me Say It", pole: 'a phrase a person would say out loud' }, b: { text: 'Unsaid', pole: 'a single literary word' } },
  { id: 't02', kind: 'pair', what: 'title', axis: 'short vs long',
    a: { text: 'Spare Key', pole: 'two words, an object' }, b: { text: 'I Never Asked for the Key Back', pole: 'a whole sentence someone would say' } },
  { id: 't03', kind: 'pair', what: 'title', axis: 'double meaning vs plain',
    a: { text: 'Overdue', pole: 'a double meaning (a library book; a love that came late)' }, b: { text: 'Too Late to Call', pole: 'a plain statement' } },
  { id: 't04', kind: 'pair', what: 'title', axis: 'specific vs universal',
    a: { text: "Sunday at Your Mother's", pole: 'a specific place and time' }, b: { text: 'Every Sunday', pole: 'a general, open frame' } },
  { id: 't05', kind: 'pair', what: 'title', axis: 'question vs statement',
    a: { text: 'Are We Still Doing This?', pole: 'a question' }, b: { text: "We're Still Doing This", pole: 'the same words as a statement' } },
  { id: 't06', kind: 'pair', what: 'title', axis: 'led by "you" vs led by "I"',
    a: { text: "You Don't Have to Stay", pole: 'aimed at "you"' }, b: { text: "I'm Not Asking You to Stay", pole: 'led by "I"' } },
  { id: 't07', kind: 'pair', what: 'title', axis: 'object vs situation',
    a: { text: 'Two Toothbrushes', pole: 'a concrete object that implies the story' }, b: { text: 'Moving Too Fast', pole: 'names the situation directly' } },
  { id: 't08', kind: 'pair', what: 'title', axis: 'tender vs bitter',
    a: { text: 'Keep the Hoodie', pole: 'tender' }, b: { text: 'Keep the Ring', pole: 'bitter' } },
  { id: 't09', kind: 'pair', what: 'title', axis: 'idiom vs fresh image',
    a: { text: 'Spilt Milk', pole: 'a stock idiom' }, b: { text: 'Red Wine on the Carpet', pole: 'a fresh image for the same thing' } },

  // ---------------------------------------------------------------- choruses
  { id: 'c01', kind: 'pair', what: 'chorus', axis: 'show vs tell',
    a: { text: "Your coat's still hanging on my door\nI don't sleep in the middle anymore", pole: 'shows it through a detail' },
    b: { text: "I'm not over you, I'm not even close\nI just got good at hiding what hurts the most", pole: 'says the feeling outright' } },
  { id: 'c02', kind: 'pair', what: 'chorus', axis: 'true slant rhyme vs forced perfect rhyme',
    a: { text: "I don't need you to say it back\nI just need you to know that", pole: 'an imperfect rhyme that keeps the line true' },
    b: { text: "I don't need you to say it back\nI just need you to cut me some slack", pole: 'a perfect rhyme bought with a stock phrase' } },
  { id: 'c03', kind: 'pair', what: 'chorus', axis: 'title first vs title last',
    a: { text: "Say when, and I'll leave it alone\nSay when, and I'll drive myself home", pole: 'the title opens both lines' },
    b: { text: "If it's too much, if you'd rather I went\nYou don't owe me a reason, just say when", pole: 'the title lands at the very end' } },
  { id: 'c04', kind: 'pair', what: 'chorus', axis: 'plainspoken vs poetic',
    a: { text: "Just say it, I can take it\nDon't wait till the morning to break it", pole: 'plainspoken' },
    b: { text: 'Say it soft, the way the rain comes down\nI can read the ending in the quiet of this town', pole: 'poetic, atmospheric' } },
  { id: 'c05', kind: 'pair', what: 'chorus', axis: 'specific vs general',
    a: { text: "Dancing in your kitchen to a song from '09\nYou burnt the garlic bread and said it tasted fine", pole: 'a specific, slightly odd detail' },
    b: { text: "Dancing in the kitchen in the middle of the night\nI didn't know then that's what love looks like", pole: 'a general picture anyone can step into' } },
  { id: 'c06', kind: 'pair', what: 'chorus', axis: 'sparse vs dense',
    a: { text: "Stay\nI'm not asking for forever, stay", pole: 'sparse, room to breathe' },
    b: { text: "Put the keys down, kick your shoes off, call in late and stay\nI'm not asking for forever, I'm just asking for today", pole: 'dense and wordy' } },
  { id: 'c07', kind: 'pair', what: 'chorus', axis: 'witty vs sincere',
    a: { text: 'You said you needed space\nSo I gave you the whole place', pole: 'witty, a twist' },
    b: { text: 'You said you needed space\nI still leave your side of the bed, just in case', pole: 'sincere, wounded' } },
  { id: 'c08', kind: 'pair', what: 'chorus', axis: 'sung to "you" vs sung about "her"',
    a: { text: 'You still call me when your flight lands\nEven now, with someone else holding your hand', pole: 'sung to "you"' },
    b: { text: 'She still calls me when her flight lands\nEven now, with someone else holding her hand', pole: 'sung about "her"' } },

  // ---------------------------------------------------------------- ideas
  { id: 'i01', kind: 'pair', what: 'idea', axis: 'everyday vs high concept',
    a: { text: "Driving her home from the party, both pretending it isn't the last time.", pole: 'an everyday situation' },
    b: { text: 'Two people who only ever meet in the same recurring dream.', pole: 'a high-concept premise' } },
  { id: 'i02', kind: 'pair', what: 'idea', axis: 'situation vs feeling',
    a: { text: 'Deleting his number for the fourth time this month.', pole: 'a situation you can see' },
    b: { text: 'The ache of loving someone you know is wrong for you.', pole: 'a feeling, named' } },
  { id: 'i03', kind: 'pair', what: 'idea', axis: 'small stakes vs big stakes',
    a: { text: 'Arguing over who keeps the friends after the breakup.', pole: 'small, domestic stakes' },
    b: { text: 'Choosing between the person you love and the city you love.', pole: 'big, life-changing stakes' } },
  { id: 'i04', kind: 'pair', what: 'idea', axis: 'sympathetic vs flawed narrator',
    a: { text: 'Begging her to give it one more try.', pole: 'a sympathetic narrator' },
    b: { text: "Admitting you were the one who wrecked it, and you'd probably do it again.", pole: 'a flawed, self-aware narrator' } },
  { id: 'i05', kind: 'pair', what: 'idea', axis: 'familiar vs fresh angle',
    a: { text: 'Being the friend she calls after every bad date.', pole: 'a familiar angle' },
    b: { text: 'Being the ex she still calls when her Wi-Fi breaks.', pole: 'a fresh, slightly comic angle' } },
  { id: 'i06', kind: 'pair', what: 'idea', axis: 'hopeful vs heartbroken',
    a: { text: 'Falling for someone at a wedding you both nearly skipped.', pole: 'hopeful' },
    b: { text: 'Seeing your ex at a wedding with the person they left you for.', pole: 'heartbroken' } },
  { id: 'i07', kind: 'pair', what: 'idea', axis: 'happening now vs looking back',
    a: { text: 'Telling her you love her for the first time, in the car, before you lose your nerve.', pole: 'happening now' },
    b: { text: "Ten years on, still thinking about the night you didn't say it.", pole: 'looking back' } },
  { id: 'i08', kind: 'pair', what: 'idea', axis: 'relatable vs unusual setting',
    a: { text: 'Falling for someone who only texts after midnight.', pole: 'widely relatable' },
    b: { text: 'Falling for the woman who cuts your hair, and booking in every three weeks.', pole: 'an unusual, specific setting' } },

  // ---------------------------------------------------------------- planted weaknesses
  { id: 'f01', kind: 'flaw', lines: ['I saw you at the station, just by chance', 'And I could feel my heart begin to dance'],
    planted: { line: 1, text: 'my heart begin to dance', flaw: 'cliché', note: 'A stock image: the dancing heart.' } },
  { id: 'f02', kind: 'flaw', lines: ["Your mum still asks me if I'm okay", "I tell her I'm fine, in every way"],
    planted: { line: 1, text: 'in every way', flaw: 'rhyme filler', note: 'Padding, there to land the rhyme.' } },
  { id: 'f03', kind: 'flaw', lines: ['You kissed me in the car park after two', 'It felt like destiny was coming true'],
    planted: { line: 1, text: 'destiny', flaw: 'inflated word', note: 'A big abstract word where a small real one would land.' } },
  { id: 'f04', kind: 'flaw', lines: ['I drive past your house with the headlights low', "She never even knew how far I'd go"],
    planted: { line: 1, text: 'She', flaw: 'pronoun slip', note: '"Your house", then "she": the line forgets who it is talking to.' } },
  { id: 'f05', kind: 'flaw', lines: ['When you walk in, I forget what I was saying', 'And you smiled like you knew that I was staying'],
    planted: { line: 1, text: 'smiled', flaw: 'tense slip', note: '"Walk" is now; "smiled" is then.' } },
  { id: 'f06', kind: 'flaw', lines: ['We shared a cigarette outside the club at three', "You said you'd never felt so heavenly"],
    planted: { line: 1, text: 'heavenly', flaw: 'wrong register', note: 'Nobody says "heavenly" outside a club at three.' } },
  { id: 'f07', kind: 'flaw', lines: ["Every time you text me, I'm a moth to a flame", 'You say you miss me and I come running all the same'],
    planted: { line: 0, text: 'a moth to a flame', flaw: 'cliché', note: 'A stock image.' } },
  { id: 'f08', kind: 'flaw', lines: ["I'd rather be lonely than be with you", "I'd rather be anywhere than here without you"],
    planted: { line: 1, text: 'without you', flaw: 'contradiction', note: "Line one would rather be alone; line two can't bear it." } },
  { id: 'f09', kind: 'flaw', lines: ['Never thought that you would go', 'Then the morning came and you said so'],
    planted: { line: 1, text: 'said so', flaw: 'rhyme filler', note: '"Said so" is only there for the rhyme.' } },
  { id: 'f10', kind: 'flaw', lines: ['Your toothbrush is still in the cup by the sink', "I'm sad that you're gone, I can't even think"],
    planted: { line: 1, text: "I'm sad that you're gone, I can't even think", flaw: 'telling what it showed', note: 'Line two tells what line one already showed.' } },

  // ---------------------------------------------------------------- clean controls
  { id: 'k01', kind: 'flaw', lines: ['You left your hoodie on my floor', "I wear it now like it's still yours"], planted: null },
  { id: 'k02', kind: 'flaw', lines: ['We split the bill like strangers do', 'You counted change, I counted you'], planted: null },
  { id: 'k03', kind: 'flaw', lines: ["I still say 'we' when I tell it to friends", 'Then I catch it, and fix it, and everyone pretends'], planted: null },
  { id: 'k04', kind: 'flaw', lines: ["You don't have to love me back tonight", "Just don't turn on the light"], planted: null },
];

export const CARD = new Map(BANK.map((c) => [c.id, c]));
