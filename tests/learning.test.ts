// What the writer notices about what Sam keeps (12 Oct 2026). Sam: "Can you somehow keep
// learning?" He types little; what he does with each idea says more.
import { describe, it, expect, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { openDb, migrate, type Db } from '../server/db.js';
import { Service } from '../server/service.js';
import { createApp } from '../server/app.js';
import { StandInWriter } from '../server/engine/standin.js';
import type { Writer, WriterRequest } from '../server/engine/writer.js';
import { learnedBlock, reflectPrompt, REFLECT_EVERY } from '../server/learning.js';
import { hitConceptsNote, hitConcepts } from '../server/engine/barometer.js';

let db: Db, svc: Service, server: Server, base: string, cookie = '';
const auth = { password: 'pw', secret: 'test-secret', secure: false };
async function boot(writer: Writer | null) {
  db = await openDb(undefined); await migrate(db);
  svc = new Service(db, writer, null);
  server = createApp(svc, auth, { writerLabel: 'test', writerLive: !!writer?.live }).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'pw' }) });
  cookie = r.headers.get('set-cookie')!.split(';')[0];
}
async function api(method: string, path: string, body?: unknown) {
  const r = await fetch(`${base}/api${path}`, { method, headers: { 'content-type': 'application/json', 'x-songroom': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
}
afterEach(async () => { await svc?.idle(); server?.close(); await db?.close(); });

let serial = 0;
const idea = (title: string) => ({ title, titleParts: [title], concept: `about ${title}`, lines: [`${title}, end of day`, 'we play', 'tonight', 'the light'], rhymes: '' });
const batchOf = (req: WriterRequest) => Number((req.user.match(/Give (\d+) distinct/) ?? [])[1] ?? 3);
const isReflect = (req: WriterRequest) => 'goesFor' in (req.schema as any).properties;
const isRework = (req: WriterRequest) => 'titleParts' in (req.schema as any).properties && 'lesson' in (req.schema as any).properties;

describe('the writer learns from what he does', () => {
  it('labels every idea he saw with what he did, strongest signals named as such', async () => {
    await boot(new StandInWriter((req: WriterRequest) => {
      if (isRework(req)) return { title: 'T', titleParts: ['T'], concept: 'c', lines: ['a'], lesson: '', scope: 'none', replaces: [], note: '' };
      return { note: '', ideas: Array.from({ length: batchOf(req) }, () => idea(`Title ${++serial}`)) };
    }));
    await api('PUT', '/springboard/direction', { genre: 'pop', text: 'Heartbreak King' });
    await api('POST', '/springboard/next', { clientKey: 'n1' }); await svc.idle();
    const a = (await api('GET', '/springboard')).body.current;            // shown: passed over once he moves on
    await api('POST', '/springboard/next', { clientKey: 'n2' });
    const b = (await api('GET', '/springboard')).body.current;            // saved
    await api('PATCH', `/ideas/${b.id}`, { saved: true });
    await api('POST', '/springboard/next', { clientKey: 'n3' }); await svc.idle();
    const c = (await api('GET', '/springboard')).body.current;            // reworked with a note
    await api('POST', `/ideas/${c.id}/rework`, { feedback: 'more obsessed', clientKey: 'rw' }); await svc.idle();
    const c2 = (await api('GET', '/springboard')).body.current;           // the rework: made a page
    await api('POST', `/ideas/${c2.id}/start`);
    await api('POST', '/browse/list', { clientKey: 'l1' }); await svc.idle();
    const list = (await api('GET', '/browse')).body.batches[0].ideas;
    await api('POST', '/springboard/current', { ideaId: list[2].id });   // picked from a list
    const outcomes = await svc.learning.outcomes();
    const by = (id: string) => outcomes.find((o) => o.id === id)!;
    expect(by(a.id).what).toBe('passed over it');
    expect(by(a.id).strength).toBe('weak');
    expect(by(a.id).direction).toBe('Heartbreak King');
    expect(by(b.id)).toMatchObject({ what: 'saved it to his journal', strength: 'strong' });
    expect(by(c.id)).toMatchObject({ what: 'reworked it with the note: "more obsessed"', strength: 'strong' });
    expect(by(c2.id)).toMatchObject({ what: 'made a page of it (started writing)', strength: 'strong' });
    expect(by(list[2].id)).toMatchObject({ what: 'picked it out of a list of ten to look at', strength: 'strong' });
    expect(by(list[0].id)).toMatchObject({ what: 'left it in the list', strength: 'weak' });
    expect(outcomes[0].id).toBe(a.id); // oldest first
    const prompt = reflectPrompt(outcomes, null);
    expect(prompt).toContain('What he was chasing that day');
    expect(prompt).toContain(`"${c2.title}"`);
    expect(prompt).toContain('his direction then: Heartbreak King');
    expect(prompt).toContain('→ made a page of it');
  });

  it(`takes stock by itself after ${REFLECT_EVERY} new ideas, and what it noticed is read with every brief, after his own words`, async () => {
    const calls: WriterRequest[] = [];
    await boot(new StandInWriter((req: WriterRequest) => {
      calls.push(req);
      if (isReflect(req)) return { goesFor: ['More like "Title 1": a plain phrase, said to one person.'], passesOn: ['Fewer third-person character studies ("Title 4", "Title 5").'], note: '' };
      return { note: '', ideas: Array.from({ length: batchOf(req) }, () => idea(`Title ${++serial}`)) };
    }));
    serial = 0;
    await api('POST', '/lessons', { text: 'Never rhyme on "forever".' });
    expect((await api('GET', '/learning')).body.learned).toBe(null);
    // the reflection waits until ten ideas have been seen, then rides along with the next batch
    let taps = 0;
    while (calls.filter(isReflect).length === 0 && taps < 16) {
      await api('POST', '/springboard/next', { clientKey: `n${++taps}` }); await svc.idle();
      const [{ n }] = await db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ideas WHERE state='shown'`);
      if (calls.filter(isReflect).length) expect(Number(n)).toBeGreaterThanOrEqual(REFLECT_EVERY);
      else expect(Number(n)).toBeLessThan(REFLECT_EVERY + 3);
    }
    expect(calls.filter(isReflect).length).toBe(1);
    for (let k = 0; k < 3; k++) { await api('POST', '/springboard/next', { clientKey: `m${k}` }); await svc.idle(); }
    expect(calls.filter(isReflect).length).toBe(1); // not again until ten more
    const g = (await api('GET', '/learning')).body;
    expect(g.learned).toMatchObject({ goesFor: ['More like "Title 1": a plain phrase, said to one person.'], passesOn: ['Fewer third-person character studies ("Title 4", "Title 5").'] });
    expect(g.learned.basis).toBeGreaterThanOrEqual(10);
    const [run] = await db.query<{ task: string; status: string }>(`SELECT task, status FROM runs WHERE task='reflect'`);
    expect(run.status).toBe('succeeded');
    // the next batch carries it, after his taste and lessons
    await api('PUT', '/springboard/direction', { genre: 'country' });
    await api('POST', '/springboard/next', { clientKey: 'x1' }); await svc.idle();
    const sys = calls.at(-1)!.system;
    expect(sys).toContain('What the writer has noticed about what Sam keeps and passes over');
    expect(sys).toContain('- More like "Title 1"');
    expect(sys).toContain('He passes on:\n- Fewer third-person');
    expect(sys.indexOf('Never rhyme on "forever"')).toBeLessThan(sys.indexOf('What the writer has noticed'));
    // forget it, and it leaves the brief; learn again on demand
    expect((await api('DELETE', '/learning')).status).toBe(200);
    expect((await api('GET', '/learning')).body.learned).toBe(null);
    await api('PUT', '/springboard/direction', { genre: 'latin' });
    await api('POST', '/springboard/next', { clientKey: 'x2' }); await svc.idle();
    expect(calls.at(-1)!.system).not.toContain('What the writer has noticed');
    const r = await api('POST', '/learning/reflect', { clientKey: 'rf' });
    expect(r.status).toBe(200);
    await svc.idle();
    expect((await api('GET', '/learning')).body.learned.goesFor).toHaveLength(1);
    expect(learnedBlock({ goesFor: [], passesOn: [], basis: 3, at: '', runId: null })).toBe('');
  });

  it('shows the writer real hits at the scale a concept lives at, and asks for a one-breath concept', async () => {
    const calls: WriterRequest[] = [];
    await boot(new StandInWriter((req: WriterRequest) => { calls.push(req); return { note: '', ideas: Array.from({ length: batchOf(req) }, () => idea(`Title ${++serial}`)) }; }));
    const ex = hitConcepts('relationship', 8, () => 0.5);
    expect(ex.length).toBe(8);
    expect(new Set(ex).size).toBe(8);
    expect(hitConceptsNote('all')).toContain('sat a month or more in the Spotify US top 50');
    await api('POST', '/springboard/next', { clientKey: 'n1' }); await svc.idle();
    const u = calls[0].user;
    expect(u).toContain('The scale a concept lives at.');
    expect(u).toContain('a stance anyone has been in, said in a breath, with no backstory');
    expect(u).toContain('the song in one breath');
    expect(u).toContain('at most 25 words');
    await api('POST', '/springboard/preview', { genre: 'pop', scope: 'relationship', clientKey: 'pv' }); await svc.idle();
    expect(calls.at(-1)!.user).toContain('The scale a concept lives at.');
  });
});
