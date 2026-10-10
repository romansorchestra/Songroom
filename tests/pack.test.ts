import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { loadPack, selectPack, renderPack, inferTask, selectProfiles } from '../server/engine/pack.js';
import { systemCore, writePrompt, editPrompt } from '../server/engine/prompts.js';

const pack = loadPack(path.resolve(process.cwd(), 'research', 'pack'));

describe('research pack', () => {
  it('loads with the counts in the manifest and valid references', () => {
    expect(pack).not.toBeNull();
    expect(pack!.cards.length).toBeGreaterThan(30);
    expect(pack!.profiles.length).toBeGreaterThan(5);
    const ids = new Set(pack!.cards.map((c) => c.id));
    for (const c of pack!.cards) {
      expect(['documented_statement', 'observable_feature', 'analytical_inference', 'sam_judgment']).toContain(c.evidence);
      for (const r of c.related ?? []) expect(ids.has(r)).toBe(true);
      expect(c.sources.length).toBeGreaterThan(0);
    }
    for (const p of pack!.pairs) { expect(p.original).toBe(true); for (const l of p.links) expect(ids.has(l)).toBe(true); }
  });

  it('infers the task from the request', () => {
    expect(inferTask('Give me three ideas about leaving lights on', false)).toBe('ideas');
    expect(inferTask('Three alternative couplets for the chorus', true)).toBe('lines');
    expect(inferTask('write the whole song', true)).toBe('draft');
    expect(inferTask('what do you think of this title', false)).toBe('unknown');
  });

  it('retrieves rhyme and stress cards for a rhyme-keeping edit, at most two', () => {
    const sel = selectPack(pack, { text: "Replace the first line, keep a natural slant rhyme with 'dreaming' and the same rhythm", task: 'edit' });
    expect(sel.cards.length).toBeLessThanOrEqual(2);
    expect(sel.cards.length).toBeGreaterThan(0);
    const tags = sel.cards.flatMap((c) => c.contexts);
    expect(tags.some((t) => ['rhyme', 'stress', 'syllables', 'melody_fit'].includes(t))).toBe(true);
    for (const c of sel.cards) expect(c.tasks).toContain('edit');
  });

  it('retrieves hook/attitude cards for a pop hook brief and nothing for an unrelated opinion', () => {
    const sel = selectPack(pack, { text: 'Three contemporary pop ideas with hooks and attitude, not stories', task: 'ideas' });
    expect(sel.cards.length).toBeGreaterThan(0);
    for (const c of sel.cards) expect(c.tasks).toContain('ideas');
    const none = selectPack(pack, { text: 'thanks', task: 'unknown' });
    expect(none.cards.length).toBe(0);
    expect(renderPack(none)).toBe('');
  });

  it('matches a reference profile by name or alias, accents ignored', () => {
    expect(selectProfiles(pack!, 'something like Adela, the Prima album').map((p) => p.id)).toContain('P01');
    expect(selectProfiles(pack!, 'in the spirit of Amy Allen').map((p) => p.id)).toContain('P02');
    expect(selectProfiles(pack!, 'no one in particular')).toEqual([]);
  });

  it('renders a short block that is framed as lenses, never as instructions to imitate', () => {
    const sel = selectPack(pack, { text: 'Three lines for the chorus, funny but it should hurt. Reference: Sabrina Carpenter', reference: 'Sabrina Carpenter', task: 'lines' });
    const block = renderPack(sel);
    expect(block).toMatch(/lenses, not rules/);
    expect(block).toMatch(/never to imitate/);
    expect(block.length).toBeLessThan(4000);
  });

  it('keeps the baseline prompt unchanged and only p2.0 carries craft notes', () => {
    expect(systemCore('p1.1')).toMatch(/situation with a turn/);
    expect(systemCore('p2.0')).not.toMatch(/situation with a turn/);
    const craft = 'Craft notes from working writers (lenses, not rules)';
    expect(writePrompt({ request: 'x', reference: null, turns: [], song: null, focus: null, craft, variant: 'p1.1' })).not.toContain(craft);
    expect(writePrompt({ request: 'x', reference: null, turns: [], song: null, focus: null, craft, variant: 'p2.0' })).toContain(craft);
    const song = { title: 't', brief: '', lyrics: 'a' };
    expect(editPrompt({ request: 'x', song, annotated: 'a', targets: [], count: 3, turns: [], craft, variant: 'p1.1' })).not.toContain(craft);
    expect(editPrompt({ request: 'x', song, annotated: 'a', targets: [], count: 3, turns: [], craft, variant: 'p2.0' })).toContain(craft);
  });
});
