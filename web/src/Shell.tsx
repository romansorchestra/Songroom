// The simple shell (3 Nov 2026): a header with a menu and a new-chat button, and a drawer
// with chats, Songs, what it remembers and Settings. The older screens (Ideas, Create, the
// detailed Journal, Hang, the taste test) are one tap away under "Older tools".

import { useEffect, useState } from 'react';
import { api } from './api';
import { go } from './App';

export type ChatRow = { id: string; title: string; song_id: string | null; song_title: string | null; updated_at: string };

const Menu = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" /></svg>;
const Pen = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>;

function when(iso: string): string {
  const d = new Date(iso.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? '' : 'Z'));
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 1) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function Shell({ children, current, title, refreshKey = 0, fill = false }: { children: React.ReactNode; current?: string; title?: React.ReactNode; refreshKey?: number; fill?: boolean }) {
  const [open, setOpen] = useState(false);
  const [chats, setChats] = useState<ChatRow[] | null>(null);
  const [older, setOlder] = useState(false);
  useEffect(() => { void api<ChatRow[]>('GET', '/chats').then(setChats).catch(() => setChats([])); }, [refreshKey, open]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);
  const nav = (path: string) => { setOpen(false); go(path); };

  return (
    <div className={`shell${fill ? ' fill' : ''}`}>
      <aside className={`drawer${open ? ' open' : ''}`} aria-label="Menu">
        <div className="drawer-inner">
          <a className="brand" href="#/" onClick={() => setOpen(false)}>songroom.</a>
          <button className="drawer-new" onClick={() => nav('/chat/new')}>{Pen}<span>New chat</span></button>
          <a className={`drawer-link${current === 'songs' ? ' on' : ''}`} href="#/songs" onClick={() => setOpen(false)}>Songs</a>
          <a className={`drawer-link${current === 'memory' ? ' on' : ''}`} href="#/memory" onClick={() => setOpen(false)}>What it remembers</a>
          <div className="drawer-head">Chats</div>
          <div className="drawer-chats">
            {chats?.length === 0 && <div className="drawer-empty">Your chats will be here.</div>}
            {chats?.map((c) => (
              <a key={c.id} className={`drawer-chat${current === c.id ? ' on' : ''}`} href={`#/chat/${c.id}`} onClick={() => setOpen(false)}>
                <span className="t">{c.song_title ? `♪ ${c.song_title}` : c.title || 'Untitled chat'}</span>
                <span className="d">{when(c.updated_at)}</span>
              </a>
            ))}
          </div>
          <div className="drawer-foot">
            <a className={`drawer-link${current === 'settings' ? ' on' : ''}`} href="#/settings" onClick={() => setOpen(false)}>Settings</a>
            <button className="drawer-link quiet" aria-expanded={older} onClick={() => setOlder((o) => !o)}>Older tools {older ? '▴' : '▾'}</button>
            {older && (
              <div className="drawer-older">
                <a href="#/ideas" onClick={() => setOpen(false)}>Ideas</a>
                <a href="#/create" onClick={() => setOpen(false)}>Create</a>
                <a href="#/journal" onClick={() => setOpen(false)}>Journal (detailed)</a>
                <a href="#/hang" onClick={() => setOpen(false)}>Hang</a>
                <a href="#/taste" onClick={() => setOpen(false)}>Taste test</a>
              </div>
            )}
          </div>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <div className="shell-main">
        <header className="bar">
          <button className="bar-btn menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(true)}>{Menu}</button>
          <div className="bar-title">{title ?? <a className="brand" href="#/">songroom.</a>}</div>
          <button className="bar-btn" aria-label="New chat" onClick={() => go('/chat/new')}>{Pen}</button>
        </header>
        {children}
      </div>
    </div>
  );
}
