// The shell (14 Oct 2026, the simplification plan): four destinations, Ideas · Create ·
// Journal · Hang, as bottom tabs on a phone and a compact top nav on a desktop. Each is a
// view over the same records. Old links keep working: #/write is Ideas, #/browse is Create,
// #/song/:id opens that song, #/idea/:id a saved idea, #/session/:id an earlier session.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { Ideas } from './Ideas';
import { Create } from './Create';
import { Workspace } from './Workspace';
import { Journal } from './Journal';
import { HangPage } from './Hang';
import { Settings } from './Settings';
import { ThreadView } from './Thread';

export type Status = {
  writer: { connected: boolean; live: boolean; label: string };
  transcriber?: { configured: boolean; label: string | null; usdPerMinute: number | null };
  settings: Record<string, any>;
  spend: { today: number; month: number; dailyCapUsd: number; monthlyCapUsd: number };
  models: Array<{ id: string; label: string; note: string }>;
};

type Ctx = { status: Status | null; refreshStatus: () => Promise<void>; toast: (s: string) => void };
const AppCtx = createContext<Ctx>({ status: null, refreshStatus: async () => {}, toast: () => {} });
export const useApp = () => useContext(AppCtx);

export function go(path: string) { window.location.hash = path; }

/** The hash route: ["create", "idea=…"] etc. A query after ? is kept on the last part. */
function useRoute(): { parts: string[]; query: URLSearchParams } {
  const read = () => {
    const raw = window.location.hash.replace(/^#/, '') || '/ideas';
    const [path, qs] = raw.split('?');
    return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs ?? '') };
  };
  const [r, setR] = useState(read);
  useEffect(() => {
    const on = () => { setR(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

const Gear = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;

const TABS: Array<{ id: 'ideas' | 'create' | 'journal' | 'hang'; label: string; href: string; icon: React.ReactNode }> = [
  { id: 'ideas', label: 'Ideas', href: '#/ideas', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2.2h5c.1-1 .5-1.7 1.1-2.2A6 6 0 0 0 12 3z" /></svg> },
  { id: 'create', label: 'Create', href: '#/create', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg> },
  { id: 'journal', label: 'Journal', href: '#/journal', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" /><path d="M8 4v16M11 8h5M11 12h5" /></svg> },
  { id: 'hang', label: 'Hang', href: '#/hang', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></svg> },
];

export function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [toastMsg, setToast] = useState('');
  const { parts, query } = useRoute();

  useEffect(() => {
    api('GET', '/session').then((s) => setSignedIn(s.signedIn)).catch(() => setSignedIn(false));
    const out = () => setSignedIn(false);
    window.addEventListener('songroom:signed-out', out);
    return () => window.removeEventListener('songroom:signed-out', out);
  }, []);

  // While he is typing on a phone, the tab bar steps out of the way of the keyboard. It comes
  // back a beat after focus leaves, so a tap that moved the focus (a button just above the bar)
  // lands before the bar reappears under it.
  useEffect(() => {
    let t = 0;
    const isField = (el: EventTarget | null) => { const e = el as HTMLElement | null; return !!e && /^(INPUT|TEXTAREA)$/.test(e.tagName) && (e as HTMLInputElement).type !== 'checkbox'; };
    const on = (e: FocusEvent) => { if (isField(e.target)) { window.clearTimeout(t); document.body.classList.add('typing'); } };
    const off = () => { window.clearTimeout(t); t = window.setTimeout(() => { if (!isField(document.activeElement)) document.body.classList.remove('typing'); }, 350); };
    document.addEventListener('focusin', on); document.addEventListener('focusout', off);
    return () => { window.clearTimeout(t); document.removeEventListener('focusin', on); document.removeEventListener('focusout', off); };
  }, []);

  const refreshStatus = useCallback(async () => { try { setStatus(await api('GET', '/status')); } catch { /* shown elsewhere */ } }, []);
  useEffect(() => { if (signedIn) void refreshStatus(); }, [signedIn, refreshStatus]);
  const toast = useCallback((s: string) => { setToast(s); window.setTimeout(() => setToast((t) => (t === s ? '' : t)), 2600); }, []);

  if (signedIn === null) return null;
  if (!signedIn) return <Login onDone={() => setSignedIn(true)} />;

  const [place, id] = parts;
  // which tab a route belongs to
  const tab: (typeof TABS)[number]['id'] | null =
    place === 'ideas' || place === 'write' && !id || place === undefined ? 'ideas'
    : place === 'create' || place === 'browse' ? 'create'
    : place === 'journal' || place === 'song' || place === 'idea' ? 'journal'
    : place === 'hang' ? 'hang' : null;
  let page: React.ReactNode;
  if (place === 'journal') page = <Journal />;
  else if (place === 'create' || place === 'browse') page = <Create key={query.toString()} ideaId={query.get('idea')} songId={query.get('song')} />;
  else if (place === 'hang') page = <HangPage key={id ?? 'list'} id={id} />;
  else if (place === 'song' && id) page = <Workspace key={id} id={id} />;
  else if (place === 'idea' && id) page = <Ideas key={id} ideaId={id} />;
  else if (place === 'settings') page = <Settings section={id} />;
  else if ((place === 'session' || (place === 'write' && id)) && id) page = <OldSession id={id} />;
  else page = <Ideas key="board" />;

  return (
    <AppCtx.Provider value={{ status, refreshStatus, toast }}>
      <div className="app">
        <header className="top">
          <div className="top-inner">
            <a className="brand" href="#/ideas">songroom.</a>
            <nav className="nav" aria-label="Main">
              {TABS.map((t) => <a key={t.id} className="nav-tab" href={t.href} aria-current={tab === t.id ? 'page' : undefined}>{t.label}</a>)}
              <a className="gear" href="#/settings" aria-label="Settings" aria-current={place === 'settings' ? 'page' : undefined}>{Gear}</a>
            </nav>
          </div>
        </header>
        <main className="page">
          {status && !status.writer.connected && <div className="banner">No writer connected. Writing and saving work; generating needs the Anthropic API key on the server.</div>}
          {status?.writer.connected && !status.writer.live && <div className="banner standin">Stand-in writer: anything generated here is placeholder text, not real writing.</div>}
          {page}
        </main>
        <nav className="tabs" aria-label="Main">
          {TABS.map((t) => <a key={t.id} href={t.href} aria-current={tab === t.id ? 'page' : undefined}>{t.icon}<span>{t.label}</span></a>)}
        </nav>
        {toastMsg && <div className="banner toast" role="status">{toastMsg}</div>}
      </div>
    </AppCtx.Provider>
  );
}

function OldSession({ id }: { id: string }) {
  return (
    <div className="pal-ochre">
      <div style={{ marginBottom: 6 }}><a className="tb under" style={{ paddingLeft: 0 }} href="#/create">← Create</a></div>
      <div className="eyebrow">Earlier session</div>
      <p className="small muted" style={{ margin: '6px 0 18px' }}>From before the new layout. Everything is kept and still works; new requests start on Create.</p>
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
