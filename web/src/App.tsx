import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { Springboard } from './Springboard';
import { Workspace } from './Workspace';
import { Journal } from './Journal';
import { Settings } from './Settings';
import { ThreadView } from './Thread';

export type Status = {
  writer: { connected: boolean; live: boolean; label: string };
  settings: Record<string, any>;
  spend: { today: number; month: number; dailyCapUsd: number; monthlyCapUsd: number };
  models: Array<{ id: string; label: string; note: string }>;
};

type Ctx = { status: Status | null; refreshStatus: () => Promise<void>; toast: (s: string) => void };
const AppCtx = createContext<Ctx>({ status: null, refreshStatus: async () => {}, toast: () => {} });
export const useApp = () => useContext(AppCtx);

export function go(path: string) { window.location.hash = path; }

function useRoute(): string[] {
  const read = () => (window.location.hash.replace(/^#/, '') || '/write').split('/').filter(Boolean);
  const [r, setR] = useState(read);
  useEffect(() => {
    const on = () => { setR(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

const Gear = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;

export function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [toastMsg, setToast] = useState('');
  const route = useRoute();

  useEffect(() => {
    api('GET', '/session').then((s) => setSignedIn(s.signedIn)).catch(() => setSignedIn(false));
    const out = () => setSignedIn(false);
    window.addEventListener('songroom:signed-out', out);
    return () => window.removeEventListener('songroom:signed-out', out);
  }, []);

  const refreshStatus = useCallback(async () => { try { setStatus(await api('GET', '/status')); } catch { /* shown elsewhere */ } }, []);
  useEffect(() => { if (signedIn) void refreshStatus(); }, [signedIn, refreshStatus]);
  const toast = useCallback((s: string) => { setToast(s); window.setTimeout(() => setToast((t) => (t === s ? '' : t)), 2600); }, []);

  if (signedIn === null) return null;
  if (!signedIn) return <Login onDone={() => setSignedIn(true)} />;

  const [place, id] = route;
  const inJournal = ['journal', 'idea'].includes(place);
  let page: React.ReactNode;
  if (place === 'journal') page = <Journal />;
  else if (place === 'song' && id) page = <Workspace key={id} id={id} />;
  else if (place === 'idea' && id) page = <Springboard key={id} ideaId={id} />;
  else if (place === 'settings') page = <Settings section={id} />;
  else if ((place === 'session' || (place === 'write' && id)) && id) page = <OldSession id={id} />;
  else page = <Springboard key="board" />;

  return (
    <AppCtx.Provider value={{ status, refreshStatus, toast }}>
      <div className="app">
        <header className="top">
          <div className="top-inner">
            <a className="brand" href="#/write">songroom.</a>
            <nav className="nav" aria-label="Main">
              <a href="#/write" aria-current={!inJournal && place !== 'settings' ? 'page' : undefined}>Write</a>
              <a href="#/journal" aria-current={inJournal ? 'page' : undefined}>Journal</a>
              <a className="gear" href="#/settings" aria-label="Settings" aria-current={place === 'settings' ? 'page' : undefined}>{Gear}</a>
            </nav>
          </div>
        </header>
        <main className="page">
          {status && !status.writer.connected && <div className="banner">No writer connected. Writing and saving work; generating needs the Anthropic API key on the server.</div>}
          {status?.writer.connected && !status.writer.live && <div className="banner standin">Stand-in writer: anything generated here is placeholder text, not real writing.</div>}
          {page}
        </main>
        {toastMsg && <div className="banner" role="status" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(env(safe-area-inset-bottom) + 16px)', zIndex: 60, background: 'var(--solid)', color: 'var(--on)', border: 0 }}>{toastMsg}</div>}
      </div>
    </AppCtx.Provider>
  );
}

function OldSession({ id }: { id: string }) {
  return (
    <div className="pal-ochre">
      <div style={{ marginBottom: 6 }}><a className="tb under" style={{ paddingLeft: 0 }} href="#/write">← Write</a></div>
      <div className="eyebrow">Earlier session</div>
      <p className="small muted" style={{ margin: '6px 0 18px' }}>From before the new layout. Everything is kept and still works; new ideas start on Write.</p>
      <ThreadView threadId={id} placeholder="Continue this session" />
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api('POST', '/login', { password: pw }); onDone(); } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }
  return (
    <main className="page pal-ochre" style={{ paddingTop: '14dvh' }}>
      <form onSubmit={submit}>
        <h1 className="idea-title"><span className="title-strip">songroom.</span></h1>
        <label className="fld">Password<input className="line" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></label>
        {err && <div className="status err" role="alert">{err}</div>}
        <div className="actions" style={{ marginTop: 12 }}><button className="primary" disabled={!pw || busy}>Sign in</button></div>
      </form>
    </main>
  );
}
