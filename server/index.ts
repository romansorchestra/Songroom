import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { openDb, migrate } from './db.js';
import { Service } from './service.js';
import { createApp } from './app.js';
import { AnthropicWriter, type Writer } from './engine/writer.js';
import { StandInWriter } from './engine/standin.js';

const here = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const env = process.env;
  // On Render the disk is mounted at /var/data; never fall back to the
  // container's own folder there, which is wiped on every deploy.
  const dbPath = env.DB_PATH ?? (existsSync('/var/data') ? '/var/data/songroom.db' : path.join(process.cwd(), '.data', 'songroom.db'));
  console.log(`Database: ${dbPath}`);
  const db = await openDb(dbPath);
  await migrate(db);

  let writer: Writer | null = null;
  if (env.ANTHROPIC_API_KEY) writer = new AnthropicWriter(env.ANTHROPIC_API_KEY);
  else if (env.SONGROOM_STANDIN === '1' && env.NODE_ENV !== 'production') writer = new StandInWriter();

  const svc = new Service(db, writer);
  const interrupted = await svc.recoverInterrupted();
  if (interrupted) console.log(`Marked ${interrupted} interrupted run(s).`);

  if (!env.SESSION_SECRET) console.warn('SESSION_SECRET not set: sessions will reset on restart.');
  const auth = { password: env.APP_PASSWORD ?? null, secret: env.SESSION_SECRET ?? randomBytes(32).toString('hex'), secure: env.NODE_ENV === 'production' };
  const staticDir = path.resolve(here, '../web');
  const app = createApp(svc, auth, { staticDir, writerLabel: writer?.label ?? 'none', writerLive: !!writer?.live });
  const port = Number(env.PORT ?? 3000);
  const server = app.listen(port, () => console.log(`Songroom on :${port} · writer: ${writer?.label ?? 'none'}`));

  const shutdown = async () => {
    server.close();
    await Promise.race([svc.idle(), new Promise((r) => setTimeout(r, 20_000))]);
    await db.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => { console.error(e); process.exit(1); });
