// A stand-in writer for checking the app's plumbing locally without spending.
// Every piece of text it returns is visibly marked "[stand-in]" and the app
// shows a banner, so it can never be mistaken for real writing. It is only
// enabled when SONGROOM_STANDIN=1 and there is no API key.

import type { Writer, WriterRequest, WriterResult } from './writer.js';

export class StandInWriter implements Writer {
  readonly live = false;
  readonly label = 'Stand-in (not real writing)';
  constructor(private script?: (req: WriterRequest) => unknown) {}

  async write(req: WriterRequest): Promise<WriterResult> {
    await new Promise((r) => setTimeout(r, 150));
    const json = this.script ? this.script(req) : this.fake(req);
    return { json, usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, model: 'stand-in', requestId: null, stopReason: 'end_turn', live: false };
  }

  private fake(req: WriterRequest): unknown {
    const props = (req.schema as { properties: Record<string, unknown> }).properties;
    const c = { count: null, linesPerOption: null, mustStartWith: null, mustEndWith: null, forbidden: [] };
    if ('candidates' in props) {
      // the hang: pick a few real phrases out of the transcript it was given
      const body = req.user.split('Transcript:\n')[1] ?? '';
      const lines = body.split('\n').map((l) => l.replace(/^\[[^\]]*\]\s*(Speaker \d+:\s*)?/, '').trim()).filter((l) => l.split(' ').length >= 4).slice(0, 3);
      return { note: '', candidates: lines.map((l, i) => ({ kind: (['title', 'line', 'concept'] as const)[i % 3], text: l.split(' ').slice(0, 4).join(' ').replace(/[.,!?]$/, ''), saidBy: '', at: '', context: l, why: '[stand-in] placeholder reason', score: 2 })) };
    }
    if ('titles' in props) {
      // titles for the next section: the stand-in reads the last word of his lyric and makes eight placeholders
      return { note: '', titles: Array.from({ length: 8 }, (_, i) => ({ title: `[stand-in] Title ${i + 1}`, lines: [`[stand-in] Title ${i + 1}, end of day`, '[stand-in] we play'], why: '[stand-in] placeholder reason' })) };
    }
    if ('goesFor' in props) {
      // taking stock of what he keeps: the stand-in names the first title it was shown
      const first = (req.user.match(/^1\. "([^"]+)"/m) ?? [])[1] ?? 'the first idea';
      return { goesFor: [`[stand-in] More like "${first}".`], passesOn: [], note: '' };
    }
    if ('titleParts' in props && 'note' in props) {
      // a rework; the stand-in "learns" only from a note that names a word to avoid (standing)
      // or names the artist (this session)
      const note = (req.user.split('His note:\n')[1] ?? '').split('\n\n')[0];
      const m = note.match(/[“"']([^“”"']+)[”"']\s+(?:is wrong|isn't right|is bad|shouldn't)/i);
      const artist = /artist is/i.test(note);
      return { title: '[stand-in] Reworked title', titleParts: ['[stand-in] Reworked', 'title'], concept: '[stand-in] Reworked concept. Placeholder, not real writing.', lines: ['[stand-in] reworked line one', '[stand-in] reworked line two'],
        lesson: m ? `[stand-in] Never use "${m[1]}" as a rhyme word.` : artist ? `[stand-in] ${note.trim()}` : '', scope: m ? 'standing' : artist ? 'session' : 'none', replaces: [], note: '' };
    }
    if ('lines' in props && 'note' in props && Object.keys(props).length === 2) {
      return { note: '', lines: [1, 2, 3, 4, 5, 6].map((n) => `[stand-in] page line ${n}`) };
    }
    if ('ideas' in props && !('kind' in props) && 'index' in (((props.ideas as { items?: { properties?: Record<string, unknown> } }).items?.properties) ?? {})) {
      // lines sent back for rhyme: the stand-in rhymes them
      const idx = [...req.user.matchAll(/^(\d+)\. "/gm)].map((m) => Number(m[1]) - 1);
      return { note: '', ideas: idx.map((i) => ({ index: i + 1, lines: ['[stand-in] I said I would, and I did', '[stand-in] I kept the receipt, I kept the lid', '[stand-in] you say my name like a dare', '[stand-in] and I show up, and I stay there'], rhymes: 'did / lid, dare / there' })) };
    }
    if ('ideas' in props && !('kind' in props)) {
      const n = Number((req.user.match(/Give (\d+) distinct/) ?? [])[1] ?? 3);
      const stamp = Math.random().toString(36).slice(2, 6);
      return { note: '', ideas: Array.from({ length: n }, (_, i) => ({
        title: `Stand-in title ${stamp}${i + 1}`, titleParts: [`Stand-in`, `title ${stamp}${i + 1}`],
        concept: `[stand-in] Placeholder concept ${i + 1}. Not real writing.`,
        // a rhymed block that opens with the title, so the checks pass unless a test scripts otherwise
        lines: [`Stand-in title ${stamp}${i + 1}, not real, end of day`, `[stand-in] first thread line ${i + 1}b, not real, we play`, `[stand-in] first thread line ${i + 1}c, not real, tonight`, `[stand-in] first thread line ${i + 1}d, not real, the light`], rhymes: 'day / play, tonight / light' })) };
    }
    if ('update' in props) {
      const optProps = ((props.options as { items?: { properties?: Record<string, unknown> } })?.items?.properties) ?? {};
      const upd = { meaning: '', narrator: '' };
      if ('targets' in optProps) {
        const n = (req.user.match(/^T\d+:/gm) ?? []).length;
        return { note: '', update: upd, options: [1, 2, 3, 4].map((o) => ({ targets: Array.from({ length: n }, (_, i) => ({ target: `T${i + 1}`, text: `[stand-in ${o}]` })) })) };
      }
      return { note: '', update: upd, options: [1, 2, 3, 4].map((o) => ({ lines: [`[stand-in] new line ${o}a`, `[stand-in] new line ${o}b`] })) };
    }
    if ('kind' in props) {
      if (/draft|write the song|full song/i.test((req.user.split('His request:').pop() ?? '').split('How to answer')[0]))
        return { kind: 'draft', reply: '[stand-in] Draft below.', ideas: [], options: [], draft: { sections: [
          { label: 'Verse 1', lines: ['[stand-in] verse line one', '[stand-in] verse line two'] },
          { label: 'Chorus', lines: ['[stand-in] chorus line one', '[stand-in] chorus line two'] } ] }, constraints: c };
      if (/Current lyric:/.test(req.user))
        return { kind: 'lines', reply: '', ideas: [], draft: null, constraints: c, options: [1, 2, 3].map((n) => ({ lines: [`[stand-in] option ${n}, first line`, `[stand-in] option ${n}, second line`] })) };
      return { kind: 'ideas', reply: '', options: [], draft: null, constraints: c, ideas: [1, 2, 3].map((n) => ({
        title: `[stand-in] Title ${n}`, concept: `[stand-in] Placeholder concept ${n}. Not real writing.`,
        lines: [`[stand-in] seed line ${n}a`, `[stand-in] seed line ${n}b`, `[stand-in] seed line ${n}c`] })) };
    }
    if ('targets' in ((props.options as { items?: { properties?: object } })?.items?.properties ?? {})) {
      const n = (req.user.match(/^T\d+:/gm) ?? []).length;
      return { reply: '', constraints: c, options: [1, 2, 3].map((o) => ({ targets: Array.from({ length: n }, (_, i) => ({ target: `T${i + 1}`, text: `[stand-in ${o}]` })) })) };
    }
    const sections = (req.user.match(/^#(\d+) \[/gm) ?? []).map((m) => Number(m.slice(1, m.indexOf(' '))));
    return { style: '[stand-in] placeholder style, not real', exclude: '', intro: ['[Intro: stand-in]'],
      sections: sections.map((index) => ({ index, tags: [`[Section ${index}: stand-in cue]`] })), outro: ['[Outro: stand-in]', '[End]'] };
  }
}
