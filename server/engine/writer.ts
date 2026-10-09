// The only place that talks to a model provider. Everything above this sees
// plain JSON plus usage; provider objects never reach the database.

import Anthropic from '@anthropic-ai/sdk';

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type WriterRequest = {
  system: string;
  user: string;
  schema: object;
  effort: Effort;
  maxTokens: number;
  model: string;
  signal?: AbortSignal;
};

export type Usage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };

export type WriterResult = {
  json: unknown;
  usage: Usage;
  model: string;
  requestId: string | null;
  stopReason: string | null;
  live: boolean;
};

export class WriterError extends Error {
  constructor(public code: 'no_key' | 'auth' | 'rate_limited' | 'balance' | 'refusal' | 'truncated' | 'bad_output' | 'timeout' | 'provider', message: string, public usage?: Usage) {
    super(message);
  }
}

export interface Writer {
  readonly live: boolean;
  readonly label: string;
  write(req: WriterRequest): Promise<WriterResult>;
}

// Dated rate snapshot (USD per million tokens), checked 8 Oct 2026 against
// Anthropic's models overview. Cache rates follow the documented multipliers.
export const RATES: Record<string, { in: number; out: number; cacheRead: number; cacheWrite: number; asOf: string }> = {
  'claude-opus-5-5': { in: 4, out: 20, cacheRead: 0.4, cacheWrite: 5, asOf: '2026-10-08' },
  'claude-fable-5-1': { in: 10, out: 50, cacheRead: 1, cacheWrite: 12.5, asOf: '2026-10-08' },
};

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'Default' },
  { id: 'claude-fable-5-1', label: 'Claude Fable 5.1', note: '2.5× the cost' },
];

export function costOf(model: string, u: Usage): number | null {
  const r = RATES[model];
  if (!r) return null;
  return (u.inputTokens * r.in + u.outputTokens * r.out + u.cacheReadTokens * r.cacheRead + u.cacheWriteTokens * r.cacheWrite) / 1e6;
}

/** Upper bound used to reserve budget before a call. */
export function worstCaseCost(model: string, inputChars: number, maxTokens: number): number | null {
  const r = RATES[model];
  if (!r) return null;
  const inputTokens = Math.ceil(inputChars / 3) + 500;
  return (inputTokens * r.cacheWrite + maxTokens * r.out) / 1e6;
}

export class AnthropicWriter implements Writer {
  readonly live = true;
  readonly label = 'Anthropic API';
  private client: Anthropic;
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 1, timeout: 180_000 });
  }

  async write(req: WriterRequest): Promise<WriterResult> {
    let res: Anthropic.Message;
    try {
      res = await this.client.messages.create(
        {
          model: req.model,
          max_tokens: req.maxTokens,
          system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: req.user }],
          output_config: { effort: req.effort, format: { type: 'json_schema', schema: req.schema as Record<string, unknown> } },
        } as Anthropic.MessageCreateParamsNonStreaming,
        { signal: req.signal },
      );
    } catch (e: unknown) {
      throw mapError(e);
    }
    const usage: Usage = {
      inputTokens: res.usage.input_tokens ?? 0,
      outputTokens: res.usage.output_tokens ?? 0,
      cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: res.usage.cache_creation_input_tokens ?? 0,
    };
    const requestId = (res as unknown as { _request_id?: string })._request_id ?? null;
    if (res.stop_reason === 'refusal') throw new WriterError('refusal', 'The writer declined this request.', usage);
    if (res.stop_reason === 'max_tokens') throw new WriterError('truncated', 'The writer ran out of room before finishing. Try a smaller request.', usage);
    const text = res.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.TextBlock).text).join('');
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new WriterError('bad_output', 'The writer returned something unreadable.', usage);
    }
    return { json, usage, model: res.model ?? req.model, requestId, stopReason: res.stop_reason, live: true };
  }
}

function mapError(e: unknown): WriterError {
  const err = e as { status?: number; message?: string; name?: string; error?: { error?: { message?: string } } };
  const msg = err.error?.error?.message ?? err.message ?? 'Unknown provider error';
  if (err.name === 'AbortError' || /aborted/i.test(msg)) return new WriterError('timeout', 'The request was cancelled.');
  if (/timed? ?out/i.test(msg)) return new WriterError('timeout', 'The writer took too long to answer.');
  if (err.status === 401 || err.status === 403) return new WriterError('auth', 'The API key was rejected. Check it in Render.');
  if (err.status === 429) return new WriterError('rate_limited', 'Anthropic is rate-limiting requests. Try again in a minute.');
  if (err.status === 400 && /credit|balance|billing/i.test(msg)) return new WriterError('balance', 'The Anthropic account is out of credit.');
  return new WriterError('provider', `Anthropic error${err.status ? ` ${err.status}` : ''}: ${msg.slice(0, 200)}`);
}
