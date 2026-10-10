// The blind experiment harness, run with the stand-in writer. This checks the
// plumbing (three conditions per trial, blinding, judging, tallies, pack
// recording), not writing quality, which only the live writer can show.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import path from 'node:path';
import { openDb, migrate, type Db } from '../server/db.js';
import { Service } from '../server/service.js';
import { createApp } from '../server/app.js';
import { StandInWriter } from '../server/engine/standin.js';
import { loadPack } from '../server/engine/pack.js';
import { waitExperiment } from '../server/experiments.js';

let db: Db, svc: Service, server: Server, base: string, cookie = '';
const auth = { password: 'pw', secret: 'test-secret', secure: false };

async function boot() {
  db = await openDb(undefined);
  await migrate(db);
  svc = new Service(db, new StandInWriter(), loadPack(path.resolve(process.cwd(), 'research', 'pack')));
  const app = createApp(svc, auth, { writerLabel: 'test', writerLive: false });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'pw' }) });
  cookie = r.headers.get('set-cookie')!.split(';')[0];
}
async function api(method: string, path: string, body?: unknown) {
  const r = await fetch(`${base}/api${path}`, { method, headers: { 'content-type': 'application/json', 'x-songroom': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
}
beforeEach(boot);
afterEach(async () => { await waitExperiment(); await svc?.idle(); server?.close(); await db?.close(); });

async function waitIdle() {
  for (let i = 0; i < 600; i++) {
    const { body } = await api('GET', '/experiments');
    if (!body.running) return body;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('experiment did not finish');
}

describe('blind experiments', () => {
  it('runs three conditions per trial, hides them until judged, and tallies', { timeout: 60000 }, async () => {
    const start = await api('POST', '/experiments/run', { ids: ['X1', 'X5', 'X3'], repeats: 1 });
    expect(start.body.started).toBe(true);
    expect(start.body.trials).toBe(3);
    const data = await waitIdle();
    expect(data.trials.length).toBe(3);
    for (const t of data.trials) {
      expect(t.positions.length).toBe(3);
      expect(t.positions.map((p: any) => p.position)).toEqual([1, 2, 3]);
      for (const p of t.positions) { expect(p.condition).toBeNull(); expect(p.status).toBe('succeeded'); }
    }
    const t = data.trials.find((x: any) => x.briefId === 'X1');
    const j = await api('POST', `/experiments/${t.id}/judge`, { vote: '2', stars: [2] });
    expect(j.status).toBe(200);
    const after = (await api('GET', '/experiments')).body.trials.find((x: any) => x.id === t.id);
    const conds = after.positions.map((p: any) => p.condition).sort();
    expect(conds).toEqual(['A', 'B', 'C']);
    const tally = (await api('GET', '/experiments/tally')).body;
    expect(tally.judged).toBe(1);
    const winner = after.positions.find((p: any) => p.position === 2).condition;
    expect(tally.conditions[winner].wins).toBe(1);
    expect(tally.conditions[winner].stars).toBe(1);
  });

  it('records the prompt variant and the pack records used on each run', { timeout: 60000 }, async () => {
    await api('POST', '/experiments/run', { ids: ['X4'], repeats: 1 });
    await waitIdle();
    const runs = await svc.db.query<{ prompt_version: string; request: { pack: null | { cards: string[] } } }>(`SELECT prompt_version, request FROM runs ORDER BY created_at`);
    const versions = runs.map((r) => r.prompt_version).sort();
    expect(versions).toEqual(['p1.1', 'p2.0', 'p2.0+pack']);
    const packed = runs.find((r) => r.prompt_version === 'p2.0+pack')!;
    expect(packed.request.pack!.cards.length).toBeGreaterThan(0);
    expect(packed.request.pack!.cards.length).toBeLessThanOrEqual(2);
    for (const r of runs.filter((x) => x.prompt_version !== 'p2.0+pack')) expect(r.request.pack).toBeNull();
  });

  it('normal writing follows the craftPack setting (off by default)', { timeout: 60000 }, async () => {
    await api('POST', '/messages', { threadId: null, text: 'Three pop ideas with hooks and attitude', clientKey: 'c1' });
    await svc.idle();
    let [run] = await svc.db.query<{ prompt_version: string }>(`SELECT prompt_version FROM runs ORDER BY created_at DESC LIMIT 1`);
    expect(run.prompt_version).toBe('p2.0');
    await api('PATCH', '/settings', { craftPack: true });
    await api('POST', '/messages', { threadId: null, text: 'Three pop ideas with hooks and attitude', clientKey: 'c2' });
    await svc.idle();
    [run] = await svc.db.query<{ prompt_version: string }>(`SELECT prompt_version FROM runs ORDER BY created_at DESC LIMIT 1`);
    expect(run.prompt_version).toBe('p2.0+pack');
  });
});
