import { useEffect, useRef, useState } from 'react';
import { api, copy } from './api';
import { Motif } from './bits';
import { go, useApp } from './App';

type Idea = { id: string; kind: 'seed' | 'line'; title: string; concept: string; lines: Array<{ id: string; text: string }>; notes: string; starred: boolean; motif: number; original: { title: string; concept: string; lines: string[] }; songs: Array<{ id: string; title: string }> };

export function IdeaPage({ id }: { id: string }) {
  const { toast } = useApp();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ title: '', concept: '', lines: '', notes: '' });
  const [state, setState] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const timer = useRef<number>(0);

  useEffect(() => {
    api<Idea>('GET', `/ideas/${id}`).then((i) => {
      setIdea(i);
      setForm({ title: i.title, concept: i.concept, lines: i.lines.map((l) => l.text).join('\n'), notes: i.notes });
    }).catch((e) => setErr(e.message));
  }, [id]);

  function edit(patch: Partial<typeof form>) {
    const next = { ...form, ...patch };
    setForm(next);
    setState('unsaved');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(next), 700);
  }

  async function save(f = form) {
    setState('saving');
    try {
      const i = await api<Idea>('PATCH', `/ideas/${id}`, { title: f.title, concept: f.concept, lines: f.lines.split('\n'), notes: f.notes });
      setIdea(i); setState('saved');
    } catch { setState('error'); }
  }

  async function patch(p: Record<string, unknown>) {
    try { setIdea(await api<Idea>('PATCH', `/ideas/${id}`, p)); } catch (e) { toast((e as Error).message); }
  }

  if (err) return <div className="error">{err}</div>;
  if (!idea) return null;
  const changed = form.title !== idea.original.title || form.concept !== idea.original.concept || form.lines !== idea.original.lines.join('\n');

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <a className="linkbtn" href="#/journal">Journal</a>
        <span className="small muted" aria-live="polite">{state === 'saving' ? 'Saving…' : state === 'unsaved' ? 'Editing' : state === 'error' ? "Couldn't save. Your text is still here." : 'Saved'}</span>
      </div>
      <article className="sheet stack" style={{ gap: 0 }}>
        <Motif n={idea.motif} />
        {idea.kind === 'seed' && <input className="title" style={{ background: 'transparent', border: 0, padding: 0, color: 'inherit', fontFamily: 'var(--serif)' }} aria-label="Title" value={form.title} onChange={(e) => edit({ title: e.target.value })} />}
        {idea.kind === 'seed' && <textarea className="concept" style={{ background: 'transparent', border: 0, padding: 0, color: 'inherit', resize: 'none' }} rows={2} aria-label="Concept" value={form.concept} onChange={(e) => edit({ concept: e.target.value })} />}
        <textarea className="lyrics" style={{ background: 'transparent', border: 0, padding: 0, color: 'inherit', resize: 'vertical', minHeight: 'calc(var(--line) * 4)' }} rows={Math.max(3, form.lines.split('\n').length)} aria-label="Lines" value={form.lines} onChange={(e) => edit({ lines: e.target.value })} />
      </article>
      <label className="field">Notes
        <textarea rows={3} value={form.notes} onChange={(e) => edit({ notes: e.target.value })} />
      </label>
      <div className="row">
        <button className="btn" onClick={async () => { const s = await api('POST', '/songs', { ideaId: id }); go(`/song/${s.id}`); }}>Develop into a song</button>
        <button className="btn quiet" onClick={() => void patch({ starred: !idea.starred })}>{idea.starred ? '★ Starred' : 'Star'}</button>
        <button className="btn quiet" onClick={() => void copy([form.title, form.concept, '', form.lines].join('\n')).then((ok) => toast(ok ? 'Copied' : 'Copy failed'))}>Copy</button>
      </div>
      {!!idea.songs.length && <div className="small">Songs from this seed: {idea.songs.map((s, i) => <span key={s.id}>{i ? ', ' : ''}<a href={`#/song/${s.id}`}>{s.title || 'Untitled'}</a></span>)}</div>}
      {changed && (
        <details className="small muted">
          <summary>As first saved</summary>
          <div className="code" style={{ marginTop: 8 }}>{[idea.original.title, idea.original.concept, '', ...idea.original.lines].join('\n')}</div>
        </details>
      )}
      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn danger sm" onClick={async () => {
          if (!confirm(idea.songs.length ? 'Delete this seed? Songs developed from it are kept.' : 'Delete this seed?')) return;
          await api('DELETE', `/ideas/${id}`); go('/journal');
        }}>Delete</button>
      </div>
    </div>
  );
}
