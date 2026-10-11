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

export type Usage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; webSearches?: number };

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

export type SearchRequest = Omit<WriterRequest, 'schema'> & { maxUses: number };
export type SearchResult = { text: string; sources: Array<{ url: string; title: string }>; usage: Usage; model: string; requestId: string | null };

export interface Writer {
  readonly live: boolean;
  readonly label: string;
  write(req: WriterRequest): Promise<WriterResult>;
  /** Plain-text answer with server-side web search; undefined when the writer can't search. */
  search?(req: SearchRequest): Promise<SearchResult>;
}

/** Anthropic web search is billed per search on top of tokens. */
export const WEB_SEARCH_USD = 0.01;

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
  return (u.inputTokens * r.in + u.outputTokens * r.out + u.cacheReadTokens * r.cacheRead + u.cacheWriteTokens * r.cacheWrite) / 1e6
    + (u.webSearches ?? 0) * WEB_SEARCH_USD;
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
  constructor(apiKey: string, workspaceId?: string) {
    // Newer multi-workspace keys must name the workspace on every request.
    this.client = new Anthropic({
      apiKey, maxRetries: 1, timeout: 180_000,
      defaultHeaders: workspaceId ? { 'anthropic-workspace-id': workspaceId } : undefined,
    });
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

  async search(req: SearchRequest): Promise<SearchResult> {
    let res: Anthropic.Message;
    try {
      res = await this.client.messages.create(
        {
          model: req.model,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [{ role: 'user', content: req.user }],
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: req.maxUses }],
          output_config: { effort: req.effort },
        } as Anthropic.MessageCreateParamsNonStreaming,
        { signal: req.signal },
      );
    } catch (e: unknown) {
      throw mapError(e);
    }
    const u = res.usage as Anthropic.Usage & { server_tool_use?: { web_search_requests?: number } };
    const usage: Usage = {
      inputTokens: u.input_tokens ?? 0, outputTokens: u.output_tokens ?? 0,
      cacheReadTokens: u.cache_read_input_tokens ?? 0, cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
      webSearches: u.server_tool_use?.web_search_requests ?? 0,
    };
    const sources: Array<{ url: string; title: string }> = [];
    for (const b of res.content as Array<{ type: string; content?: unknown }>) {
      if (b.type === 'web_search_tool_result' && Array.isArray(b.content))
        for (const r of b.content as Array<{ type: string; url?: string; title?: string }>)
          if (r.type === 'web_search_result' && r.url && !sources.some((x) => x.url === r.url)) sources.push({ url: r.url, title: r.title ?? r.url });
    }
    const text = res.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.TextBlock).text).join('');
    if (res.stop_reason === 'refusal') throw new WriterError('refusal', 'The writer declined this request.', usage);
    return { text, sources, usage, model: res.model ?? req.model, requestId: (res as unknown as { _request_id?: string })._request_id ?? null };
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
  if (err.status === 400 && /web search.*not enabled|web_search/i.test(msg)) return new WriterError('provider', 'Web search is turned off for this Anthropic account.');
  return new WriterError('provider', `Anthropic error${err.status ? ` ${err.status}` : ''}: ${msg.slice(0, 200)}`);
}
