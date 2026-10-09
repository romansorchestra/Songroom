import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, clientKey, copy, draftStore, waitForRun, type Check } from './api';
import { Checks, Menu, Thinking, Icon } from './bits';
import { useApp, go } from './App';
import { EditOptions, type EditPayload } from './edits';

type Idea = { title: string; concept: string; lines: string[]; checks?: Check[] };
type Option = { lines: string[]; checks?: Check[] };
type Payload = {
  kind?: string; reply?: string; ideas?: Idea[]; options?: any[]; draft?: { sections: Array<{ label: string; lines: string[] }> } | null;
  checks?: Check[]; reference?: string | null; focus?: string | null; blocked?: string; selection?: string; edit?: boolean; direct?: boolean; note?: string;
};
type Msg = { id: string; role: 'user' | 'assistant'; text: string; run_id: string | null; payload: Payload | null; created_at: string };
type RunRow = { id: string; status: string; error: { message?: string } | null; created_at: string };
type ThreadData = { id: string; title: string; song_id: string | null; messages: Msg[]; runs: RunRow[]; saved: Record<string, string> };

export function useThread(threadId: string | null) {
  const [data, setData] = useState<ThreadData | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    if (!threadId) { setData(null); return null; }
    try {
      const t = await api<ThreadData>('GET', `/threads/${threadId}`);
      setData(t); setErr('');
      return t;
    } catch (e) { setErr((e as Error).message); return null; }
  }, [threadId]);
  useEffect(() => { void load(); }, [load]);
  return { data, setData, load, err };
}

/** Messages and cards for a writing session (Write, or a song's Talk tab). */
export function ThreadView(props: {
  threadId: string | null;
  songId?: string | null;
  songRev?: number;
  onSongChanged?: () => void;
  onThreadCreated?: (id: string) => void;
  emptyState?: React.ReactNode;
  placeholder: string;
}) {
  const { threadId, songId } = props;
  const { toast } = useApp();
  const { data, load } = useThread(threadId);
  const [pending, setPending] = useState<{ text: string; reference?: string | null } | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const draftKey = threadId ?? (songId ? `song:${songId}` : 'new');
  const [text, setText] = useState(() => draftStore.get(draftKey));
  const [reference, setReference] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ label: string; text: string } | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setText(draftStore.get(draftKey)); setError(''); }, [draftKey]);
  useEffect(() => { draftStore.set(draftKey, text); }, [draftKey, text]);

  // Resume waiting if a run is still going (e.g. after a refresh).
  useEffect(() => {
    const live = data?.runs?.find((r) => r.status === 'running');
    if (live && running !== live.id) follow(live.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [data?.messages.length, pending, running]);

  async function follow(runId: string) {
    setRunning(runId);
    try {
      const run = await waitForRun(runId);
      if (run.status === 'failed') setError(run.error?.message ?? 'The writer failed. Your words are safe.');
    } catch (e) { setError((e as Error).message); }
    setRunning(null);
    setPending(null);
    await load();
  }

  async function send(msg?: string, opts?: { focus?: string | null }) {
    const body = (msg ?? text).trim();
    if (!body || running) return;
    setError('');
    setPending({ text: body, reference });
    if (!msg) setText('');
    const key = clientKey();
    try {
      const r = await api('POST', '/messages', { threadId, songId: threadId ? null : songId ?? null, text: body, reference, focus: opts?.focus ?? focus?.text ?? null, clientKey: key });
      setReference(null); setFocus(null);
      if (!threadId) { draftStore.set(draftKey, ''); props.onThreadCreated?.(r.threadId); }
      await follow(r.runId);
    } catch (e) {
      const ae = e as ApiError;
      if (ae.status === 0) { setText(body); }
      setError(ae.message);
      setPending(null);
      if (threadId) await load();
      else if (ae.status === 503 || ae.status === 402) {
        // The server kept the message in a new session; find it.
        const list = await api<Array<{ id: string }>>('GET', '/threads').catch(() => []);
        if (list[0] && !songId) props.onThreadCreated?.(list[0].id);
      }
    }
  }

  async function cancel() {
    if (running) await api('POST', `/runs/${running}/cancel`).catch(() => {});
  }

  const saveIdea = async (key: string, runId: string, idea: { title: string; concept: string; lines: string[] }, kind: 'seed' | 'line' = 'seed') => {
    try {
      const r = await api('POST', '/ideas', { sourceKey: key, kind, title: idea.title, concept: idea.concept, lines: idea.lines, sourceRunId: runId });
      toast(r.created ? 'Saved to Journal' : 'Already in Journal');
      await load();
      return r.id as string;
    } catch (e) { toast((e as Error).message); return null; }
  };

  const moreLike = (label: string, body: string) => {
    setFocus({ label, text: body });
    taRef.current?.focus();
  };

  const develop = async (key: string, runId: string, idea: Idea) => {
    const id = data?.saved[key] ?? await saveIdea(key, runId, idea);
    if (!id) return;
    const s = await api('POST', '/songs', { ideaId: id });
    go(`/song/${s.id}`);
  };

  const useDraft = async (runId: string, draft: NonNullable<Payload['draft']>) => {
    if (!songId) {
      const text = draft.sections.map((s) => `[${s.label}]\n${s.lines.join('\n')}`).join('\n\n');
      const s = await api('POST', '/songs', { title: data?.title?.slice(0, 60) ?? '', text });
      go(`/song/${s.id}`);
      return;
    }
    try {
      await api('POST', `/songs/${songId}/draft`, { baseRev: props.songRev, sections: draft.sections, runId });
      toast('Draft is now the current version. The old one is in History.');
      props.onSongChanged?.();
    } catch (e) { toast((e as Error).message); }
  };

  const msgs = data?.messages ?? [];
  const failedRuns = (data?.runs ?? []).filter((r) => r.status !== 'running');
  const lastUserAt = msgs.filter((m) => m.role === 'user').at(-1)?.created_at;
  const lastAnswered = msgs.at(-1)?.role === 'assistant';

  return (
    <>
      <div className="thread">
        {!msgs.length && !pending && props.emptyState}
        {msgs.map((m) => m.role === 'user'
          ? <div key={m.id} className="you">
              {m.text}
              {m.payload?.selection && <div className="meta">On {m.payload.selection}</div>}
              {m.payload?.reference && <div className="meta">Reference: {m.payload.reference}</div>}
              {m.payload?.focus && <div className="meta">Pointing at: {m.payload.focus.slice(0, 120)}{m.payload.focus.length > 120 ? '…' : ''}</div>}
              {m.payload?.blocked && <div className="meta error">Not sent to the writer: {m.payload.blocked}</div>}
            </div>
          : m.payload?.kind === 'edit' && songId
            ? <EditOptions key={m.id} songId={songId} p={m.payload as unknown as EditPayload} runId={m.run_id} onApplied={() => props.onSongChanged?.()} toast={toast} />
            : <Answer key={m.id} m={m} saved={data?.saved ?? {}} songId={songId ?? null}
              onSave={saveIdea} onMore={moreLike} onDevelop={develop} onUseDraft={useDraft} toast={toast} />)}
        {failedRuns.filter((r) => !lastAnswered && lastUserAt && r.created_at >= lastUserAt && !running).slice(-1).map((r) => (
          <div key={r.id} className="error">{r.status === 'cancelled' ? 'Stopped.' : r.error?.message ?? 'That request failed.'} <button className="linkbtn" onClick={() => { const last = msgs.filter((x) => x.role === 'user').at(-1); if (last) void send(last.text); }}>Try again</button></div>
        ))}
        {pending && !msgs.some((m) => m.role === 'user' && m.text === pending.text && running) && <div className="you">{pending.text}</div>}
        {running && <Thinking onCancel={cancel} />}
        {error && !running && <div className="error" role="alert">{error}</div>}
        <div ref={bottom} />
      </div>

      <div className="composer">
        <div className="inner">
          {focus && <div className="chip">More like {focus.label}<button className="iconbtn" aria-label="Clear" onClick={() => setFocus(null)}>×</button></div>}
          {reference !== null && (
            <input type="text" value={reference} autoFocus placeholder="Reference song – and what you like about it (optional)"
              onChange={(e) => setReference(e.target.value)} aria-label="Reference" />
          )}
          <div className="line">
            <textarea ref={taRef} rows={1} value={text} placeholder={props.placeholder} aria-label={props.placeholder}
              onChange={(e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px`; }}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }} />
            <button className="btn send" aria-label="Send" disabled={!text.trim() || !!running} onClick={() => void send()}>{Icon.send}</button>
          </div>
          {reference === null && <button className="linkbtn" onClick={() => setReference('')}>Add a reference</button>}
        </div>
      </div>
    </>
  );
}

function ideaText(i: Idea) { return `${i.title}\n${i.concept}\n\n${i.lines.join('\n')}`; }

function Answer({ m, saved, songId, onSave, onMore, onDevelop, onUseDraft, toast }: {
  m: Msg; saved: Record<string, string>; songId: string | null;
  onSave: (key: string, runId: string, idea: { title: string; concept: string; lines: string[] }, kind?: 'seed' | 'line') => Promise<string | null>;
  onMore: (label: string, body: string) => void;
  onDevelop: (key: string, runId: string, idea: Idea) => void;
  onUseDraft: (runId: string, d: NonNullable<Payload['draft']>) => void;
  toast: (s: string) => void;
}) {
  const p = m.payload ?? {};
  const run = m.run_id ?? 'x';
  return (
    <div className="stack">
      {m.text && <div className="reply">{m.text}</div>}
      <Checks checks={p.checks?.filter((c) => !c.ok)} />
      {!!p.ideas?.length && (
        <div className="cards">
          {p.ideas.map((idea, i) => {
            const key = `${run}:i${i}`;
            return (
              <article key={i} className="sheet">
                <h3 className="title">{idea.title}</h3>
                <p className="concept">{idea.concept}</p>
                <div className="lyrics">{idea.lines.join('\n')}</div>
                <Checks checks={idea.checks?.filter((c) => !c.ok)} />
                <div className="actions">
                  <button className={`btn ink sm ${saved[key] ? 'on' : ''}`} onClick={() => void onSave(key, run, idea)}>{saved[key] ? 'Saved' : 'Save'}</button>
                  <button className="btn ink sm" onClick={() => onMore(`“${idea.title}”`, ideaText(idea))}>More like this</button>
                  <Menu label="More actions" items={[
                    { label: 'Develop into a song', onClick: () => onDevelop(key, run, idea) },
                    ...idea.lines.map((l, n) => ({ label: `Save line: “${l.length > 32 ? l.slice(0, 30) + '…' : l}”`, onClick: () => void onSave(`${key}:l${n}`, run, { title: idea.title, concept: '', lines: [l] }, 'line') })),
                    { label: 'Copy', onClick: () => void copy(ideaText(idea)).then((ok) => toast(ok ? 'Copied' : 'Copy failed')) },
                  ]} />
                </div>
              </article>
            );
          })}
        </div>
      )}
      {!!p.options?.length && (
        <div className="cards">
          {(p.options as Option[]).map((o, i) => {
            const key = `${run}:o${i}`;
            const body = o.lines.join('\n');
            return (
              <article key={i} className="sheet">
                <div className="lyrics">{body}</div>
                <Checks checks={o.checks} />
                <div className="actions">
                  <button className={`btn ink sm ${saved[key] ? 'on' : ''}`} onClick={() => void onSave(key, run, { title: o.lines[0]?.slice(0, 60) ?? '', concept: '', lines: o.lines }, 'line')}>{saved[key] ? 'Saved' : 'Save'}</button>
                  <button className="btn ink sm" onClick={() => void copy(body).then((ok) => toast(ok ? 'Copied' : 'Copy failed'))}>Copy</button>
                  <button className="btn ink sm" onClick={() => onMore(`option ${i + 1}`, body)}>More like this</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {p.draft && (
        <article className="sheet">
          {p.draft.sections.map((s, i) => (
            <div key={i} className="section">
              {s.label && <div className="label">{s.label}</div>}
              <div className="lyrics">{s.lines.join('\n')}</div>
            </div>
          ))}
          <div className="actions">
            <button className="btn ink sm" onClick={() => onUseDraft(run, p.draft!)}>{songId ? 'Use this draft' : 'Start a song from this'}</button>
            <button className="btn ink sm" onClick={() => void copy(p.draft!.sections.map((s) => `[${s.label}]\n${s.lines.join('\n')}`).join('\n\n')).then((ok) => toast(ok ? 'Copied' : 'Copy failed'))}>Copy</button>
          </div>
        </article>
      )}
    </div>
  );
}

