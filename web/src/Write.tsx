import { useEffect, useState } from 'react';
import { api } from './api';
import { timeAgo } from './bits';
import { ThreadView } from './Thread';
import { go } from './App';

export function Write({ threadId }: { threadId: string | null }) {
  const [sessions, setSessions] = useState<Array<{ id: string; title: string; updated_at: string }>>([]);
  useEffect(() => { if (!threadId) api('GET', '/threads').then(setSessions).catch(() => {}); }, [threadId]);

  const empty = (
    <div className="empty">
      <h1>What are you working on?</h1>
      <p className="muted">Ask for ideas, titles or lines. Paste a lyric to work on it. Say “more like the second one” or “same idea from her side” as you go.</p>
      {!!sessions.length && (
        <div className="sessions">
          <div className="small muted">Recent sessions</div>
          {sessions.slice(0, 8).map((s) => (
            <a key={s.id} href={`#/write/${s.id}`}><span>{s.title || 'Untitled session'}</span><span className="small muted">{timeAgo(s.updated_at)}</span></a>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {threadId && <div className="row" style={{ marginBottom: 12 }}><a className="linkbtn" href="#/write">New session</a></div>}
      <ThreadView threadId={threadId} placeholder="What are you working on?" emptyState={empty}
        onThreadCreated={(id) => go(`/write/${id}`)} />
    </>
  );
}
