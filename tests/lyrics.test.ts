import { describe, it, expect } from 'vitest';
import {
  parseLyrics, renderLyrics, allLines, reparsePreservingIds, parseLiteral, literalReplacements,
  applyReplacements, buildReplacements, resolveTargets, type Target,
} from '../server/engine/lyrics.js';
import { endsWithPhrase, startsWithPhrase, containsWord, extractConstraints, checkCandidate, mergeConstraints } from '../server/engine/validate.js';

const E1 = '[Chorus]\nI kept coming home\nLike that was the same as staying\nYou were learning to let go\nI was practicing leaving';

describe('parsing keeps his words exactly', () => {
  it('preserves text, curly apostrophes, emoji and converts CRLF', () => {
    const raw = "[Verse 1]\r\nYou got used to leaving lights on\r\nAnd plates by the stove ’cause I’m late 🙃\r\n\r\nChorus:\r\nI was practicing losing";
    const s = parseLyrics(raw);
    expect(s.map((x) => x.label)).toEqual(['Verse 1', 'Chorus']);
    expect(allLines(s).map((l) => l.text)).toEqual(['You got used to leaving lights on', 'And plates by the stove ’cause I’m late 🙃', 'I was practicing losing']);
  });
  it('blank lines split unlabelled sections', () => {
    const s = parseLyrics('a\nb\n\nc');
    expect(s.length).toBe(2);
  });
  it('keeps line IDs through a free-text edit', () => {
    const s = parseLyrics(E1);
    const ids = allLines(s).map((l) => l.id);
    const next = reparsePreservingIds(s, E1.replace('leaving', 'losing').replace('I kept coming home', 'I kept coming home\nNew line here'));
    const n = allLines(next);
    expect(n[0].id).toBe(ids[0]);
    expect(n[1].text).toBe('New line here');
    expect(n[2].id).toBe(ids[1]);
    expect(n[4].id).toBe(ids[3]); // edited line keeps its ID
    expect(n[4].text).toBe('I was practicing losing');
  });
});

describe('literal edits (E1, E3)', () => {
  it('E1: changes exactly one word, everything else byte-for-byte', () => {
    const s = parseLyrics(E1);
    const lit = parseLiteral('Change only the final word from leaving to losing. Keep everything else exactly the same.');
    expect(lit).toEqual({ from: 'leaving', to: 'losing' });
    const last = allLines(s)[3];
    const reps = literalReplacements(s, [{ kind: 'span', lineId: last.id, start: 17, end: 24, expected: 'leaving' }], lit!.from, lit!.to, new Set());
    const out = applyReplacements(s, reps, new Set());
    expect(renderLyrics(out)).toBe(E1.replace('practicing leaving', 'practicing losing'));
  });
  it('E3: both pre-choruses change, the verse "quit" does not', () => {
    const raw = "[Verse 1]\nI quit calling after midnight\n\n[Pre-Chorus]\nQuit getting mad\nI should've been scared of that\n\n[Verse 2]\nYou packed the winter coats in June\n\n[Pre-Chorus]\nQuit getting mad\nI should've been scared of that";
    const s = parseLyrics(raw);
    const lit = parseLiteral("In both pre-choruses change 'Quit getting mad' to 'You stopped getting mad'. Don't change any other use of quit or any other lyric.");
    expect(lit).toEqual({ from: 'Quit getting mad', to: 'You stopped getting mad' });
    const reps = literalReplacements(s, null, lit!.from, lit!.to, new Set());
    expect(reps.length).toBe(2);
    const out = renderLyrics(applyReplacements(s, reps, new Set()));
    expect(out).toBe(raw.replaceAll('Quit getting mad', 'You stopped getting mad'));
    expect(out).toContain('I quit calling after midnight');
  });
  it('whole-word only: "quit" does not hit "quite"', () => {
    const s = parseLyrics('quite a quit');
    const reps = literalReplacements(s, null, 'quit', 'stop', new Set());
    expect(allLines(applyReplacements(s, reps, new Set()))[0].text).toBe('quite a stop');
  });
  it('creative requests are not treated as literal', () => {
    expect(parseLiteral('Give three replacements for only the first line. Remove leaving while keeping a rhyme')).toBeNull();
    expect(parseLiteral('change this line to something sadder')).toBeNull();
  });
  it('locked lines are skipped by literal edits', () => {
    const s = parseLyrics('leaving\nleaving');
    const [a] = allLines(s);
    const reps = literalReplacements(s, null, 'leaving', 'losing', new Set([a.id]));
    expect(reps.length).toBe(1);
    expect(reps[0].lineId).not.toBe(a.id);
  });
});

describe('span edits can only touch the span', () => {
  const s = parseLyrics(E1);
  const last = allLines(s)[3];
  const t: Target = { kind: 'span', lineId: last.id, start: 17, end: 24, expected: 'leaving' };
  it('rebuilds prefix + proposal + suffix', () => {
    expect(buildReplacements(s, [t], ['losing'])[0].newText).toBe('I was practicing losing');
  });
  it('drops an echoed prefix instead of doubling it', () => {
    expect(buildReplacements(s, [t], ['I was practicing losing'])[0].newText).toBe('I was practicing losing');
  });
  it('rejects line breaks, stale selections and locked lines', () => {
    expect(() => buildReplacements(s, [t], ['los\ning'])).toThrow();
    expect(() => resolveTargets(s, [{ ...t, expected: 'staying' }], new Set())).toThrow(/changed/);
    expect(() => resolveTargets(s, [t], new Set([last.id]))).toThrow(/locked/);
    expect(() => applyReplacements(s, [{ lineId: last.id, newText: 'x' }], new Set([last.id]))).toThrow(/locked/);
  });
});

describe('constraint checks', () => {
  it('end/start phrases ignore case, punctuation and curly quotes', () => {
    expect(endsWithPhrase('I was busy losing you.', 'losing you')).toBe(true);
    expect(endsWithPhrase('I was busy closing you', 'losing you')).toBe(false);
    expect(startsWithPhrase('“I was practicing losing', 'I was practicing losing')).toBe(true);
    expect(containsWord('Don’t keep leaving', 'leaving')).toBe(true);
    expect(containsWord('Don’t keep leave', 'leaving')).toBe(false);
  });
  it('reads explicit counts and endings from the request', () => {
    const c = extractConstraints("Three alternative two-line chorus endings. Each must end with the exact words 'losing you'.");
    expect(c.count).toBe(3);
    expect(c.mustEndWith).toBe('losing you');
  });
  it('flags a candidate that breaks a hard constraint', () => {
    const c = mergeConstraints({ count: 3, linesPerOption: 2, mustStartWith: null, mustEndWith: 'losing you', forbidden: ['leaving', 'breathing'] }, {});
    const bad = checkCandidate(['I kept leaving', 'and then I lost'], c, { checkLineCount: true });
    expect(bad.filter((x) => !x.ok).map((x) => x.label)).toEqual(['ends “losing you”', 'avoids “leaving”']);
    const good = checkCandidate(['Turns out the quiet was the sound', 'of me slowly losing you'], c, { checkLineCount: true });
    expect(good.every((x) => x.ok)).toBe(true);
  });
});
