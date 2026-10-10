// One small database interface over SQLite (built into Node, ~50 MB of memory),
// stored in a single file on Render's disk. Queries are written with $1, $2…
// placeholders; JSON columns are stored as text and parsed on the way out.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  tx<T>(fn: (q: Db['query']) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Columns holding JSON text. They are parsed when read. */
const JSON_COLS = new Set(['value', 'request', 'result', 'error', 'usage', 'payload', 'lines', 'original', 'locks', 'suno', 'sections', 'trial']);

function toParam(v: unknown): null | number | bigint | string | Uint8Array {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'string' || v instanceof Uint8Array) return v;
  return JSON.stringify(v);
}

function fromRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'string' && JSON_COLS.has(k)) {
      try { out[k] = JSON.parse(v); } catch { out[k] = v; }
    } else out[k] = v;
  }
  return out;
}

/** Open the database. `file` undefined → in-memory (tests). */
export async function openDb(file?: string): Promise<Db> {
  if (file) mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new DatabaseSync(file ?? ':memory:');
  sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  sqlite.function('now', () => new Date().toISOString());

  const run = <T,>(sql: string, params: unknown[] = []): T[] => {
    const stmt = sqlite.prepare(sql.replace(/\$(\d+)/g, '?$1'));
    const bound = params.map(toParam);
    if (/^\s*(select|with)\b/i.test(sql) || /\breturning\b/i.test(sql)) return stmt.all(...bound).map((r) => fromRow(r as Record<string, unknown>)) as T[];
    stmt.run(...bound);
    return [];
  };

  // One connection: queries and transactions take turns so a query from another
  // request can never land inside someone else's open transaction.
  let chain: Promise<unknown> = Promise.resolve();
  const exclusive = <T,>(fn: () => Promise<T> | T): Promise<T> => {
    const next = chain.then(fn);
    chain = next.catch(() => {});
    return next;
  };

  return {
    query: <T,>(sql: string, params: unknown[] = []) => exclusive(() => run<T>(sql, params)),
    tx: <T,>(fn: (q: Db['query']) => Promise<T>) => exclusive(async () => {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const out = await fn(async <U,>(sql: string, params: unknown[] = []) => run<U>(sql, params));
        sqlite.exec('COMMIT');
        return out;
      } catch (e) {
        try { sqlite.exec('ROLLBACK'); } catch { /* already rolled back */ }
        throw e;
      }
    }),
    close: async () => { await chain; sqlite.close(); },
  };
}

const TS = `TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

const MIGRATIONS: string[] = [
  `CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
   CREATE TABLE threads (
     id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '', song_id TEXT, kind TEXT NOT NULL DEFAULT 'normal',
     created_at ${TS}, updated_at ${TS});
   CREATE TABLE runs (
     id TEXT PRIMARY KEY, thread_id TEXT, song_id TEXT, task TEXT NOT NULL, status TEXT NOT NULL,
     client_key TEXT UNIQUE, model TEXT, effort TEXT, prompt_version TEXT,
     request TEXT NOT NULL, result TEXT, error TEXT, usage TEXT, cost_usd REAL, reserved_usd REAL,
     request_id TEXT, live INTEGER NOT NULL DEFAULT 1,
     created_at ${TS}, finished_at TEXT);
   CREATE INDEX runs_thread ON runs(thread_id, created_at);
   CREATE INDEX runs_day ON runs(created_at);
   CREATE TABLE messages (
     id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
     role TEXT NOT NULL, text TEXT NOT NULL, run_id TEXT, payload TEXT,
     created_at ${TS});
   CREATE INDEX messages_thread ON messages(thread_id, created_at);
   CREATE TABLE ideas (
     id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', concept TEXT NOT NULL DEFAULT '',
     lines TEXT NOT NULL DEFAULT '[]', notes TEXT NOT NULL DEFAULT '', starred INTEGER NOT NULL DEFAULT 0,
     original TEXT NOT NULL, source_run_id TEXT, source_key TEXT UNIQUE, motif INTEGER NOT NULL DEFAULT 0,
     archived INTEGER NOT NULL DEFAULT 0, created_at ${TS}, updated_at ${TS});
   CREATE TABLE songs (
     id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '', brief TEXT NOT NULL DEFAULT '',
     current_rev INTEGER NOT NULL DEFAULT 1, locks TEXT NOT NULL DEFAULT '[]', idea_id TEXT,
     notes TEXT NOT NULL DEFAULT '', starred INTEGER NOT NULL DEFAULT 0, motif INTEGER NOT NULL DEFAULT 0,
     suno TEXT, archived INTEGER NOT NULL DEFAULT 0, kind TEXT NOT NULL DEFAULT 'normal',
     created_at ${TS}, updated_at ${TS});
   CREATE TABLE song_revisions (
     song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE, rev INTEGER NOT NULL,
     sections TEXT NOT NULL, source TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', run_id TEXT,
     created_at ${TS}, PRIMARY KEY (song_id, rev));
   CREATE TABLE voice_examples (
     id TEXT PRIMARY KEY, direction TEXT NOT NULL DEFAULT '', text TEXT NOT NULL, created_at ${TS});
   CREATE TABLE eval_results (
     id TEXT PRIMARY KEY, batch TEXT NOT NULL, brief_id TEXT NOT NULL, run_id TEXT, result TEXT NOT NULL,
     vote TEXT, created_at ${TS})`,
  // 2 (10 Oct 2026): blind prompt/research experiments. One row per (batch, brief, repeat); the
  // three outputs and their hidden conditions live in `trial`; `vote` is a position, 'none' or 'tie'.
  `CREATE TABLE experiments (
     id TEXT PRIMARY KEY, batch TEXT NOT NULL, brief_id TEXT NOT NULL, repeat INTEGER NOT NULL DEFAULT 1,
     trial TEXT NOT NULL, vote TEXT, stars TEXT, note TEXT, created_at ${TS});
   CREATE INDEX experiments_batch ON experiments(batch, created_at)`,
];

export async function migrate(db: Db): Promise<void> {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at ${TS})`);
  const done = new Set((await db.query<{ version: number }>(`SELECT version FROM schema_migrations`)).map((r) => Number(r.version)));
  for (let i = 0; i < MIGRATIONS.length; i++) {
    if (done.has(i + 1)) continue;
    await db.tx(async (q) => {
      for (const stmt of MIGRATIONS[i].split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await q(stmt);
      await q(`INSERT INTO schema_migrations(version) VALUES ($1)`, [i + 1]);
    });
  }
}
