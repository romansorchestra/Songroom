import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { Icon } from './bits';
import { Write } from './Write';
import { Journal } from './Journal';
import { SongPage } from './SongPage';
import { IdeaPage } from './IdeaPage';
import { Settings } from './Settings';

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
  const inJournal = ['journal', 'song', 'idea'].includes(place);
  let page: React.ReactNode;
  if (place === 'journal') page = <Journal />;
  else if (place === 'song' && id) page = <SongPage key={id} id={id} />;
  else if (place === 'idea' && id) page = <IdeaPage key={id} id={id} />;
  else if (place === 'settings') page = <Settings section={id} />;
  else page = <Write key={id ?? 'new'} threadId={id ?? null} />;

  return (
    <AppCtx.Provider value={{ status, refreshStatus, toast }}>
      <div className="app">
        <header className="top">
          <nav className="places" aria-label="Places">
            <a href="#/write" aria-current={place === 'write' || !place ? 'page' : undefined}>Write</a>
            <a href="#/journal" aria-current={inJournal ? 'page' : undefined}>Journal</a>
          </nav>
          <span className="spacer" />
          <a className="iconbtn" href="#/settings" aria-label="Settings" aria-current={place === 'settings' ? 'page' : undefined}>{Icon.gear}</a>
        </header>
        <main>
          {status && !status.writer.connected && <div className="banner">No writer connected yet. Writing, saving and editing by hand all work; generating needs the Anthropic API key on the server.</div>}
          {status?.writer.connected && !status.writer.live && <div className="banner standin">Stand-in writer: everything generated is placeholder text, not real writing.</div>}
          {page}
        </main>
        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      </div>
    </AppCtx.Provider>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await api('POST', '/login', { password: pw }); onDone(); } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }
  return (
    <div className="login">
      <form className="sheet stack" onSubmit={submit}>
        <h1 className="title">Songroom</h1>
        <input type="password" autoComplete="current-password" placeholder="Password" aria-label="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        {err && <div className="error" role="alert">{err}</div>}
        <div><button className="btn" disabled={!pw || busy}>Sign in</button></div>
      </form>
    </div>
  );
}
