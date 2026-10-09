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
