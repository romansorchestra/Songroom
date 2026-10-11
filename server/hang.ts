// The hang (11 Oct 2026): the hour of talk before a writing session, read afterwards for
// titles, concepts and lines. Two ways in: a pasted transcript (no setup), or a recording
// (transcribed by an outside service behind one key). The transcript lives only until the
// candidates are out; what stays is each candidate and the sentence around it.

import fs from 'node:fs';
import { Service, AppError, motifFor } from './service.js';
import { newId } from './engine/lyrics.js';
import { hangSchema, hangZ } from './engine/schemas.js';
import { HANG_SYSTEM, hangPrompt, PROMPT_VERSION } from './engine/prompts.js';
import { WriterError } from './engine/writer.js';
import { TranscribeError, type Transcriber } from './engine/transcribe.js';
import type { Studio } from './studio.js';

export type Candidate = { kind: 'title' | 'concept' | 'line'; text: string; saidBy: string; at: string; context: string; why: string; score: number };
type HangRow = {
  id: string; title: string; status: string; source: string; minutes: number | null; speakers: number | null; transcript: string | null;
  candidates: Candidate[]; dismissed: number[]; error: { code: string; message: string } | null; run_id: string | null; created_at: string; updated_at: string;
};

export const MAX_TRANSCRIPT_CHARS = 120_000; // about two hours of talk
export const MAX_AUDIO_BYTES = 250 * 1024 * 1024;

const norm = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();

/** Keep only candidates whose words are really in the transcript; fix a context that isn't. */
export function verifyCandidates(raw: Candidate[], transcript: string): Candidate[] {
  const T = norm(transcript);
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const c of raw) {
    const text = c.text.trim().replace(/^["“]|["”]$/g, '').trim();
    const nt = norm(text);
    if (!nt || nt.length < 3) continue;
    const at = T.indexOf(nt);
    if (at < 0) continue;
    if ([...seen].some((s) => s === nt || s.includes(nt) || nt.includes(s))) continue; // the same phrase, longer or shorter
    seen.add(nt);
    let context = c.context.trim();
    if (!T.includes(norm(context)) || norm(context).split(' ').length > 45) {
      // the transcript's own window around the phrase
      const lines = transcript.split('\n');
      const line = lines.find((l) => norm(l).includes(nt)) ?? '';
      const i = norm(line).indexOf(nt);
      context = line ? line.slice(Math.max(0, i - 90), Math.min(line.length, i + nt.length + 90)).trim() : text;
      if (context.length > 240) context = `${context.slice(0, 237)}…`;
    }
    out.push({ kind: c.kind, text, saidBy: c.saidBy.trim().slice(0, 40), at: c.at.trim().slice(0, 12), context, why: c.why.trim().slice(0, 120), score: Math.min(3, Math.max(1, Math.round(c.score))) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 25);
}

export class Hang {
  constructor(public svc: Service, public studio: Studio, public transcriber: Transcriber | null = null) {}
  get db() { return this.svc.db; }

  status() { return { configured: !!this.transcriber, label: this.transcriber?.label ?? null, usdPerMinute: this.transcriber?.usdPerMinute ?? null }; }

  async list() {
    const rows = await this.db.query<HangRow>(`SELECT id, title, status, source, minutes, speakers, candidates, dismissed, error, created_at, updated_at FROM hangs ORDER BY created_at DESC LIMIT 100`);
    return rows.map((r) => ({ ...r, candidates: r.candidates.length, transcript: undefined }));
  }

  async get(id: string) {
    const [r] = await this.db.query<HangRow>(`SELECT * FROM hangs WHERE id=$1`, [id]);
    if (!r) throw new AppError(404, 'not_found', 'That session is not here.');
    const { transcript: _t, ...rest } = r;
    return { ...rest, hasTranscript: !!r.transcript };
  }

  /** A pasted transcript: straight to the reader. */
  async fromText(input: { title: string; text: string }) {
    const text = input.text.replace(/\r\n?/g, '\n').trim();
    if (text.length < 40) throw new AppError(400, 'too_short', 'That is too short to be a session. Paste the whole transcript.');
    if (text.length > MAX_TRANSCRIPT_CHARS) throw new AppError(413, 'too_long', 'That transcript is longer than two hours of talk. Split it in two.');
    const id = newId('h_');
    await this.db.query(`INSERT INTO hangs(id, title, status, source, transcript, minutes) VALUES ($1,$2,'extracting','text',$3,$4)`, [id, input.title.trim().slice(0, 120), text, Math.round(text.split(/\s+/).length / 140)]);
    await this.extract(id).catch(async (e) => this.fail(id, e));
    return { id };
  }

  /** A recording on disk: transcribe in the background, then read. */
  async fromAudio(input: { title: string; filePath: string; contentType: string; bytes: number }) {
    if (!this.transcriber) { fs.rm(input.filePath, () => {}); throw new AppError(503, 'no_transcriber', 'Recordings need a transcription key (DEEPGRAM_API_KEY) in Render. Pasting a transcript works now.'); }
    if (!this.svc.writer) { fs.rm(input.filePath, () => {}); throw new AppError(503, 'no_writer', 'No writer is connected.'); }
    const id = newId('h_');
    await this.db.query(`INSERT INTO hangs(id, title, status, source) VALUES ($1,$2,'transcribing','audio')`, [id, input.title.trim().slice(0, 120)]);
    const job = (async () => {
      try {
        const t = await this.transcriber!.transcribe(input.filePath, input.contentType);
        const cost = Math.round(t.minutes * this.transcriber!.usdPerMinute * 1e6) / 1e6;
        await this.db.query(
          `INSERT INTO runs(id, task, status, model, effort, prompt_version, request, result, usage, cost_usd, reserved_usd, live, finished_at)
           VALUES ($1,'transcribe','succeeded',$2,'none',$3,$4,$5,'{"inputTokens":0,"outputTokens":0,"cacheReadTokens":0,"cacheWriteTokens":0}',$6,0,1,now())`,
          [newId('r_'), t.provider, PROMPT_VERSION, JSON.stringify({ hangId: id, bytes: input.bytes, minutes: t.minutes }), JSON.stringify({ minutes: t.minutes, speakers: t.speakers }), cost],
        );
        await this.db.query(`UPDATE hangs SET status='extracting', transcript=$2, minutes=$3, speakers=$4, updated_at=now() WHERE id=$1`, [id, t.text.slice(0, MAX_TRANSCRIPT_CHARS), t.minutes, t.speakers]);
        await this.extract(id);
      } catch (e) { await this.fail(id, e); }
      finally { fs.rm(input.filePath, () => {}); }
    })();
    this.svc.track(job);
    return { id };
  }

  private async fail(id: string, e: unknown) {
    const code = e instanceof TranscribeError ? e.code : e instanceof AppError ? e.code : 'internal';
    const message = e instanceof Error ? e.message : 'Something went wrong.';
    if (code === 'internal') console.error('hang failed', id, e);
    await this.db.query(`UPDATE hangs SET status='failed', error=$2, updated_at=now() WHERE id=$1`, [id, JSON.stringify({ code, message })]);
  }

  /** One reading of the transcript; the transcript is cleared when the candidates are in. */
  private async extract(id: string) {
    const [h] = await this.db.query<HangRow>(`SELECT * FROM hangs WHERE id=$1`, [id]);
    if (!h?.transcript) throw new AppError(400, 'no_transcript', 'Nothing to read.');
    const s = await this.svc.settings();
    const user = hangPrompt({ title: h.title, transcript: h.transcript });
    const run = await this.svc.startRun({
      task: 'hang', threadId: null, songId: null, clientKey: `hang:${id}`, effort: s.effortCreative,
      request: { hangId: id, chars: h.transcript.length }, inputChars: HANG_SYSTEM.length + user.length,
      exec: async (signal, model) => {
        try {
          const r = await this.svc.call('hang', HANG_SYSTEM, user, hangSchema, s.effortCreative, signal, model);
          const parsed = hangZ.safeParse(r.json);
          if (!parsed.success) throw new WriterError('bad_output', 'The reader returned an unexpected shape.', r.usage);
          return { result: parsed.data as unknown as Record<string, unknown>, usage: r.usage, requestId: r.requestId, model: r.model, live: r.live };
        } catch (e) {
          await this.fail(id, e);
          throw e;
        }
      },
      onSuccess: async (runId, result) => {
        const out = result as unknown as { candidates: Candidate[]; note: string };
        const [row] = await this.db.query<{ transcript: string | null }>(`SELECT transcript FROM hangs WHERE id=$1`, [id]);
        const kept = verifyCandidates(out.candidates, row?.transcript ?? '');
        await this.db.query(`UPDATE hangs SET status='done', candidates=$2, transcript=NULL, run_id=$3, updated_at=now() WHERE id=$1`, [id, JSON.stringify(kept), runId]);
      },
    });
    await this.db.query(`UPDATE hangs SET run_id=$2 WHERE id=$1 AND run_id IS NULL`, [id, run.id]);
  }

  async dismiss(id: string, index: number, undo = false) {
    const [h] = await this.db.query<HangRow>(`SELECT dismissed FROM hangs WHERE id=$1`, [id]);
    if (!h) throw new AppError(404, 'not_found', 'That session is not here.');
    const set = new Set(h.dismissed); if (undo) set.delete(index); else set.add(index);
    await this.db.query(`UPDATE hangs SET dismissed=$2, updated_at=now() WHERE id=$1`, [id, JSON.stringify([...set])]);
    return this.get(id);
  }

  /** A candidate becomes the idea on the Write screen: its words as the title, the moment as the first line. */
  async toIdea(id: string, index: number) {
    const [h] = await this.db.query<HangRow>(`SELECT * FROM hangs WHERE id=$1`, [id]);
    const c = h?.candidates[index];
    if (!c) throw new AppError(404, 'not_found', 'That one is not here any more.');
    const [existing] = await this.db.query<{ id: string }>(`SELECT id FROM ideas WHERE source_run_id=$1 AND note=$2`, [`${id}:${index}`, `From the hang${h.title ? ` · ${h.title}` : ''}`]);
    if (existing) { await this.studio.setCurrent(existing.id); return { ideaId: existing.id }; }
    const [{ n }] = await this.db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ideas WHERE origin='spark'`);
    const ideaId = newId('i_');
    const title = (c.kind === 'concept' ? c.text.split(/[.,;:]/)[0] : c.text).trim().slice(0, 120);
    const concept = c.kind === 'concept' ? c.text : `${c.saidBy ? `${c.saidBy} said it` : 'Said in the room'}${c.at ? ` at ${c.at}` : ''}. ${c.why}`.trim();
    const lines = [c.kind === 'line' ? c.text : c.context].map((t) => t.replace(/^\[[^\]]*\]\s*(Speaker \d+:\s*)?/, '').trim()).filter(Boolean);
    const now = new Date().toISOString();
    await this.db.query(
      `INSERT INTO ideas(id, kind, title, concept, lines, original, source_run_id, motif, saved, origin, state, shown_at, palette, steer, note)
       VALUES ($1,'seed',$2,$3,$4,$5,$6,$7,0,'spark','shown',$8,$9,$10,$11)`,
      [ideaId, title, concept.slice(0, 600), JSON.stringify(lines.map((t) => ({ id: newId('l_'), text: t }))), JSON.stringify({ title, concept, lines, hang: id, index }),
        `${id}:${index}`, motifFor(ideaId), now, ['ochre', 'sage', 'blue'][Number(n) % 3], JSON.stringify({ text: '', refId: null }), `From the hang${h.title ? ` · ${h.title}` : ''}`],
    );
    await this.studio.setCurrent(ideaId);
    return { ideaId };
  }

  /** Save a candidate to the journal: it becomes a saved idea. */
  async save(id: string, index: number) {
    const { ideaId } = await this.toIdea(id, index);
    await this.studio.patchIdea(ideaId, { saved: true });
    return { ideaId };
  }

  async remove(id: string) {
    await this.db.query(`DELETE FROM hangs WHERE id=$1`, [id]);
    return { ok: true };
  }
}
