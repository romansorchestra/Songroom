// Speech to text for "the hang": the hour of talk before a writing session. Claude does
// not transcribe audio, so this is one outside service behind one key. Deepgram takes a
// whole recording in one request (no chunking), labels speakers, and bills by the minute.
// The transcript it returns is kept only until the candidates are pulled out of it.

import { createReadStream, statSync } from 'node:fs';
import { Readable } from 'node:stream';

export type Transcript = { text: string; minutes: number; speakers: number; provider: string };

export interface Transcriber {
  label: string;
  /** USD per minute of audio, for the receipt. */
  usdPerMinute: number;
  transcribe(filePath: string, contentType: string, signal?: AbortSignal): Promise<Transcript>;
}

export class TranscribeError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

type DgWord = { word: string; punctuated_word?: string; start: number; end: number; speaker?: number };
type DgResponse = {
  metadata?: { duration?: number };
  results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string; words?: DgWord[] }> }> };
};

/** Words into "[m:ss] Speaker N: …" paragraphs: a new paragraph on a speaker change or a long pause. */
export function layout(words: DgWord[]): { text: string; speakers: number } {
  const paras: string[] = [];
  let cur: string[] = [], curSpeaker: number | undefined, curStart = 0, lastEnd = 0;
  const speakers = new Set<number>();
  const flush = () => { if (cur.length) paras.push(`[${fmt(curStart)}]${curSpeaker !== undefined ? ` Speaker ${curSpeaker + 1}:` : ''} ${cur.join(' ')}`); cur = []; };
  for (const w of words) {
    if (w.speaker !== undefined) speakers.add(w.speaker);
    const gap = w.start - lastEnd;
    if (cur.length && (w.speaker !== curSpeaker || gap > 2.5 || cur.length > 120)) flush();
    if (!cur.length) { curSpeaker = w.speaker; curStart = w.start; }
    cur.push(w.punctuated_word ?? w.word);
    lastEnd = w.end;
  }
  flush();
  return { text: paras.join('\n'), speakers: speakers.size };
}

export class DeepgramTranscriber implements Transcriber {
  label = 'Deepgram nova-3';
  usdPerMinute = 0.0077;
  constructor(private key: string, private base = 'https://api.deepgram.com') {}

  async transcribe(filePath: string, contentType: string, signal?: AbortSignal): Promise<Transcript> {
    const size = statSync(filePath).size;
    const url = `${this.base}/v1/listen?model=nova-3&smart_format=true&punctuate=true&diarize=true&filler_words=false`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Token ${this.key}`, 'Content-Type': contentType || 'application/octet-stream', 'Content-Length': String(size) },
        body: Readable.toWeb(createReadStream(filePath)) as unknown as BodyInit,
        // @ts-expect-error node fetch needs this for a streaming body
        duplex: 'half',
        signal,
      });
    } catch (e) {
      throw new TranscribeError('network', `Couldn't reach the transcription service: ${(e as Error).message}`);
    }
    if (res.status === 401 || res.status === 403) throw new TranscribeError('auth', 'The transcription key was refused. Check DEEPGRAM_API_KEY in Render.');
    if (res.status === 402) throw new TranscribeError('balance', 'The transcription account is out of credit.');
    if (!res.ok) throw new TranscribeError('provider', `Transcription failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as DgResponse;
    const alt = data.results?.channels?.[0]?.alternatives?.[0];
    const words = alt?.words ?? [];
    const minutes = (data.metadata?.duration ?? (words.at(-1)?.end ?? 0)) / 60;
    if (!words.length && !alt?.transcript) throw new TranscribeError('empty', 'Nothing was heard in that recording.');
    const { text, speakers } = words.length ? layout(words) : { text: alt!.transcript!, speakers: 0 };
    return { text, minutes, speakers, provider: this.label };
  }
}

export function transcriberFromEnv(env: NodeJS.ProcessEnv): Transcriber | null {
  if (env.DEEPGRAM_API_KEY) return new DeepgramTranscriber(env.DEEPGRAM_API_KEY);
  return null;
}
