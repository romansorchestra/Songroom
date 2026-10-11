// The rhyme checker (11 Oct 2026): Sam noticed ideas usually carried one rhyme at most.
import { describe, it, expect } from 'vitest';
import { rhymeKind, rhymeReport, rhymesEnough } from '../server/engine/rhyme.js';

const k = (a: string, b: string) => rhymeKind(a.split(' '), b.split(' ')).kind;

describe('rhyme by sound', () => {
  it('knows perfect, slant, identical and none', () => {
    expect(k('mind', 'find')).toBe('perfect');
    expect(k('wine', 'mine')).toBe('perfect');
    expect(rhymeKind(['towels'], ['vowels'])).toEqual({ kind: 'perfect', rich: true });
    expect(k('mind', 'fine')).toBe('slant');
    expect(k('home', 'alone')).toBe('slant');
    expect(k('again', 'friend')).toBe('slant');
    expect(rhymeKind(['forever'], ['together']).rich).toBe(true);
    expect(k('day', 'today')).toBe('identical');   // the same word inside a longer one
    expect(k('light', 'sleep')).toBe('none');
    expect(k('all', 'while')).toBe('none');
    expect(k('through', 'threw')).toBe('perfect');  // sound, not spelling
    expect(['perfect', 'slant']).toContain(k('darlin\'', 'starling')); // the dictionary's own dropped-g entry
  });
  it('reports end-rhymes across a block and judges whether it is enough', () => {
    const his = ["You fold the towels in three now, you never folded towels at all", "You say darlin' like it's been in your mouth a while", 'Who taught you that', "I won't ask twice, I'll just watch"];
    expect(rhymeReport(his).score).toBe(0);
    expect(rhymesEnough(his)).toBe(false);
    const rhymed = ["I don't even like brunch, I just like you on a Sunday", "Forty minutes on the sidewalk for eggs, and I'd do it twice", "I'm smiling at the waitress like I've lost my whole mind", "I used to have opinions, now I've got your sweater, fine"];
    const r = rhymeReport(rhymed);
    expect(r.pairs.map((p) => `${p.words[0]}/${p.words[1]}:${p.kind}`)).toContain('mind/fine:slant');
    expect(rhymesEnough(rhymed)).toBe(false); // one pair in four lines is exactly his complaint
    const two = ["Put your card away, babe, I'll get my own", "I got the corner booth and a ride back home", "It's not that you're not cute, you're kind of cute", "I just don't want to owe you, and that's the truth"];
    expect(rhymeReport(two).score).toBe(2);
    expect(rhymesEnough(two)).toBe(true);
  });
});
