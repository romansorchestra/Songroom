// Thin client for the server API. Every write sends the X-Songroom header.

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public extra: Record<string, unknown> = {}) { super(message); }
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-songroom': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'offline', "Can't reach Songroom. Check your connection; nothing you typed has been lost.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error ?? {};
    if (res.status === 401 && e.code === 'signed_out') window.dispatchEvent(new Event('songroom:signed-out'));
    throw new ApiError(res.status, e.code ?? 'error', e.message ?? `Request failed (${res.status}).`, e);
  }
  return data as T;
}

export const clientKey = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());

export async function waitForRun(runId: string, onTick?: () => void): Promise<any> {
  let delay = 1200;
  for (;;) {
    const run = await api('GET', `/runs/${runId}`);
    if (run.status !== 'running') return run;
    onTick?.();
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 300, 2500);
  }
}

export async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

// Drafts typed but not yet sent survive reloads and lost connections.
export const draftStore = {
  get(k: string): string { try { return localStorage.getItem(`draft:${k}`) ?? ''; } catch { return ''; } },
  set(k: string, v: string) { try { v ? localStorage.setItem(`draft:${k}`, v) : localStorage.removeItem(`draft:${k}`); } catch { /* storage unavailable */ } },
};

export type Section = { id: string; label: string; lines: Array<{ id: string; text: string }> };
export type Check = { label: string; ok: boolean };
