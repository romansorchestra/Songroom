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
    if ('titleParts' in props && 'note' in props) {
      return { title: '[stand-in] Reworked title', titleParts: ['[stand-in] Reworked', 'title'], concept: '[stand-in] Reworked concept. Placeholder, not real writing.', lines: ['[stand-in] reworked line one', '[stand-in] reworked line two'], note: '' };
    }
    if ('lines' in props && 'note' in props && Object.keys(props).length === 2) {
      return { note: '', lines: [1, 2, 3, 4, 5, 6].map((n) => `[stand-in] page line ${n}`) };
    }
    if ('ideas' in props && !('kind' in props)) {
      const n = Number((req.user.match(/Give (\d+) distinct/) ?? [])[1] ?? 3);
      const stamp = Math.random().toString(36).slice(2, 6);
      return { note: '', ideas: Array.from({ length: n }, (_, i) => ({
        title: `Stand-in title ${stamp}${i + 1}`, titleParts: [`Stand-in`, `title ${stamp}${i + 1}`],
        concept: `[stand-in] Placeholder concept ${i + 1}. Not real writing.`,
        lines: [`[stand-in] first thread line ${i + 1}a`, `[stand-in] first thread line ${i + 1}b`] })) };
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
