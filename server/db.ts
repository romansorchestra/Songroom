// One small database interface. Production uses Postgres (Render); local runs
// and tests use PGlite, an in-process Postgres, so the SQL is identical.

import pg from 'pg';

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  tx<T>(fn: (q: Db['query']) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function openDb(url: string | undefined, dataDir?: string): Promise<Db> {
  if (url) {
    const pool = new pg.Pool({
      connectionString: url,
      // Render's internal URL (host without a dot) is a private network: no TLS.
      // External hosts get TLS; an explicit sslmode in the URL is left to pg.
      ssl: /sslmode=/.test(url) ? undefined
        : (() => { const host = new URL(url).hostname; return host.includes('.') && host !== '127.0.0.1' ? { rejectUnauthorized: false } : undefined; })(),
      max: 5,
    });
    const query = async <T,>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as T[];
    return {
      query,
      async tx(fn) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const out = await fn(async <T,>(sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows as T[]);
          await client.query('COMMIT');
          return out;
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const lite = new PGlite(dataDir);
  let chain: Promise<unknown> = Promise.resolve();
  const query = async <T,>(sql: string, params: unknown[] = []) => (await lite.query(sql, params)).rows as T[];
  return {
    query,
    tx(fn) {
      // PGlite is single-connection: serialise transactions.
      const run = chain.then(() => lite.transaction((t) => fn(async <T,>(sql: string, params: unknown[] = []) => (await t.query(sql, params)).rows as T[])));
      chain = run.catch(() => {});
      return run;
    },
    close: () => lite.close(),
  };
}

const MIGRATIONS: string[] = [
  `CREATE TABLE settings (key text PRIMARY KEY, value jsonb NOT NULL);
   CREATE TABLE threads (
     id text PRIMARY KEY, title text NOT NULL DEFAULT '', song_id text, kind text NOT NULL DEFAULT 'normal',
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
   CREATE TABLE runs (
     id text PRIMARY KEY, thread_id text, song_id text, task text NOT NULL, status text NOT NULL,
     client_key text UNIQUE, model text, effort text, prompt_version text,
     request jsonb NOT NULL, result jsonb, error jsonb, usage jsonb, cost_usd numeric, reserved_usd numeric,
     request_id text, live boolean NOT NULL DEFAULT true,
     created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz);
   CREATE INDEX runs_thread ON runs(thread_id, created_at);
   CREATE INDEX runs_day ON runs(created_at);
   CREATE TABLE messages (
     id text PRIMARY KEY, thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
     role text NOT NULL, text text NOT NULL, run_id text, payload jsonb,
     created_at timestamptz NOT NULL DEFAULT now());
   CREATE INDEX messages_thread ON messages(thread_id, created_at);
   CREATE TABLE ideas (
     id text PRIMARY KEY, kind text NOT NULL, title text NOT NULL DEFAULT '', concept text NOT NULL DEFAULT '',
     lines jsonb NOT NULL DEFAULT '[]', notes text NOT NULL DEFAULT '', starred boolean NOT NULL DEFAULT false,
     original jsonb NOT NULL, source_run_id text, source_key text UNIQUE, motif int NOT NULL DEFAULT 0,
     archived boolean NOT NULL DEFAULT false,
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
   CREATE TABLE songs (
     id text PRIMARY KEY, title text NOT NULL DEFAULT '', brief text NOT NULL DEFAULT '',
     current_rev int NOT NULL DEFAULT 1, locks jsonb NOT NULL DEFAULT '[]', idea_id text,
     notes text NOT NULL DEFAULT '', starred boolean NOT NULL DEFAULT false, motif int NOT NULL DEFAULT 0,
     suno jsonb, archived boolean NOT NULL DEFAULT false, kind text NOT NULL DEFAULT 'normal',
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
   CREATE TABLE song_revisions (
     song_id text NOT NULL REFERENCES songs(id) ON DELETE CASCADE, rev int NOT NULL,
     sections jsonb NOT NULL, source text NOT NULL, note text NOT NULL DEFAULT '', run_id text,
     created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (song_id, rev));
   CREATE TABLE voice_examples (
     id text PRIMARY KEY, direction text NOT NULL DEFAULT '', text text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now());
   CREATE TABLE eval_results (
     id text PRIMARY KEY, batch text NOT NULL, brief_id text NOT NULL, run_id text, result jsonb NOT NULL,
     vote text, created_at timestamptz NOT NULL DEFAULT now());`,
];

export async function migrate(db: Db): Promise<void> {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await db.query<{ version: number }>(`SELECT version FROM schema_migrations`)).map((r) => Number(r.version)));
  for (let i = 0; i < MIGRATIONS.length; i++) {
    if (done.has(i + 1)) continue;
    await db.tx(async (q) => {
      for (const stmt of MIGRATIONS[i].split(';').map((s) => s.trim()).filter(Boolean)) await q(stmt);
      await q(`INSERT INTO schema_migrations(version) VALUES ($1)`, [i + 1]);
    });
  }
}
