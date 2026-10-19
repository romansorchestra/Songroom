// The taste test (18 Oct 2026). Sam: "I don't love the way that I have to enter all that
// information on the settings… Can you design a more intuitive and clever way to test my
// taste and my level of judgment?"
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { openDb, migrate, type Db } from '../server/db.js';
import { Service } from '../server/service.js';
import { createApp } from '../server/app.js';
import { StandInWriter } from '../server/engine/standin.js';
import { BANK, CARD, type FlawCard, type PairCard } from '../server/engine/tasteBank.js';
import { score, tastePrompt, Taste, QUOTA, REPEATS, type Answer, type ShownCard } from '../server/taste.js';
import { wordsOf, tapHits } from '../shared/taste.js';

let db: Db, svc: Service, server: Server, base: string, cookie = '';
const auth = { password: 'pw', secret: 'test-secret', secure: false };
async function boot() {
  db = await openDb(undefined); await migrate(db);
  svc = new Service(db, new StandInWriter(), null);
  server = createApp(svc, auth, { writerLabel: 'test', writerLive: false }).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'pw' }) });
  cookie = r.headers.get('set-cookie')!.split(';')[0];
}
async function api(method: string, path: string, body?: unknown) {
  const r = await fetch(`${base}/api${path}`, { method, headers: { 'content-type': 'application/json', 'x-songroom': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
}
afterEach(async () => { await svc?.idle(); server?.close(); await db?.close(); });

/** The word index that hits the planted text. */
const plantedTap = (c: FlawCard) => ({ line: c.planted!.line, word: wordsOf(c.lines[c.planted!.line]).findIndex((_, i) => tapHits(c.lines[c.planted!.line], i, c.planted!.text)) });
/** Answer a drawn session: always side a, every planted weakness caught, clean ones fine. */
function answerAll(cards: ShownCard[]): Answer[] {
  return cards.map((c) => c.kind === 'pair'
    ? { card: c.id, kind: 'pair', repeat: c.repeat, pick: 'a', ms: 1500 }
    : { card: c.id, kind: 'flaw', tap: c.planted ? plantedTap(CARD.get(c.id) as FlawCard) : null, ms: 2500 });
}

describe('the cards', () => {
  it('are well formed: unique ids, planted text really in its line, the two sides different', () => {
    const ids = BANK.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of BANK) {
      if (c.kind === 'pair') { expect(c.a.text).not.toBe(c.b.text); expect(c.a.pole && c.b.pole && c.axis).toBeTruthy(); }
      else if (c.planted) {
        const line = c.lines[c.planted.line];
        expect(line.indexOf(c.planted.text), `${c.id}`).toBeGreaterThanOrEqual(0);
        expect(line.indexOf(c.planted.text), `${c.id} planted twice`).toBe(line.lastIndexOf(c.planted.text));
        expect(plantedTap(c).word, `${c.id}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('use no title of a song that charted', () => {
    const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    const charted = new Set((JSON.parse(fs.readFileSync('research/charts/classified.json', 'utf8')) as Array<{ title: string }>).map((x) => norm(x.title)));
    for (const c of BANK) if (c.kind === 'pair' && c.what === 'title') for (const t of [c.a.text, c.b.text]) expect(charted.has(norm(t)), t).toBe(false);
  });
});

describe('a session', () => {
  it('draws ten pairs and four choruses, interleaved, then two pairs again with the sides swapped', async () => {
    await boot();
    const cards = await new Taste(svc).draw();
    expect(cards.length).toBe(QUOTA.title + QUOTA.chorus + QUOTA.idea + QUOTA.planted + QUOTA.clean + REPEATS);
    const pairs = cards.filter((c): c is Extract<ShownCard, { kind: 'pair' }> => c.kind === 'pair' && !c.repeat);
    expect(pairs.filter((c) => c.what === 'title').length).toBe(QUOTA.title);
    const flaws = cards.filter((c) => c.kind === 'flaw');
    expect(flaws.filter((c) => c.kind === 'flaw' && c.planted).length).toBe(QUOTA.planted);
    for (let i = 1; i < cards.length; i++) expect(cards[i].kind === 'flaw' && cards[i - 1].kind === 'flaw').toBe(false);
    const repeats = cards.slice(-REPEATS) as Array<Extract<ShownCard, { kind: 'pair' }>>;
    for (const r of repeats) {
      expect(r.repeat).toBe(true);
      const first = pairs.find((p) => p.id === r.id)!;
      expect(cards.indexOf(first)).toBeLessThan(7);
      expect(r.options.map((o) => o.side)).toEqual([...first.options.map((o) => o.side)].reverse());
    }
  });

  it('the next session shows cards he has not answered yet', async () => {
    await boot();
    const first = await new Taste(svc).draw();
    await api('POST', '/taste/read', { session: 'sess-1', answers: answerAll(first) }); await svc.idle();
    const second = (await api('GET', '/taste')).body.cards as ShownCard[];
    const before = new Set(first.map((c) => c.id));
    for (const c of second) if (!(c.kind === 'pair' && c.repeat)) expect(before.has(c.id), c.id).toBe(false);
  });
});

describe('the score', () => {
  it('counts caught, let through, a different word, clean ones and the same call twice', () => {
    const f01 = CARD.get('f01') as FlawCard, f03 = CARD.get('f03') as FlawCard, f05 = CARD.get('f05') as FlawCard;
    const anyWordOfPhrase = { line: 1 as const, word: wordsOf(f01.lines[1]).findIndex((w) => w.text === 'dance') };
    const s = score([
      { card: 't01', kind: 'pair', pick: 'a', ms: 900 }, { card: 't02', kind: 'pair', pick: 'neither', ms: 4000 },
      { card: 'f01', kind: 'flaw', tap: anyWordOfPhrase, ms: 2000 },                     // a word inside the planted phrase counts
      { card: 'f03', kind: 'flaw', tap: { line: 0, word: 2 }, why: "wouldn't say it", ms: 3000 }, // another word
      { card: 'f05', kind: 'flaw', tap: null, mind: 'fine', ms: 3000 },                   // let through
      { card: 'k01', kind: 'flaw', tap: null, ms: 1000 }, { card: 'k02', kind: 'flaw', tap: { line: 1, word: 0 }, why: 'vague', ms: 1000 },
      { card: 't01', kind: 'pair', repeat: true, pick: 'a', ms: 800 }, { card: 't02', kind: 'pair', repeat: true, pick: 'a', ms: 800 },
    ]);
    expect(f03.planted && f05.planted).toBeTruthy();
    expect(s).toMatchObject({ pairs: 2, neither: 1, planted: 3, caught: 1, otherWord: 1, letThrough: 1, clean: 2, cleanFine: 1, repeats: 1, same: 1 });
  });

  it('tells the writer the poles he never saw, what he found himself, and what he does not mind', () => {
    const k02 = CARD.get('k02') as FlawCard;
    const answers: Answer[] = [
      { card: 't01', kind: 'pair', pick: 'a', ms: 1200 }, { card: 'c02', kind: 'pair', pick: 'a', ms: 2100 },
      { card: 'k02', kind: 'flaw', tap: { line: 1, word: 1 }, why: 'cliché', ms: 4000 },
      { card: 'f05', kind: 'flaw', tap: null, mind: 'fine', ms: 3000 },
    ];
    const p = tastePrompt(answers, score(answers), '');
    expect(p).toContain('- Axis: conversational vs literary (title)');
    expect(p).toContain('(a phrase a person would say out loud)');
    expect(p).toContain(`he chose "${(CARD.get('t01') as PairCard).a.text}", in 1.2 s`);
    expect(p).toContain(`he tapped "${wordsOf(k02.lines[1])[1].text.replace(/[^\p{L}']/gu, '')}", and said what's wrong with it: cliché. (He found this himself.)`);
    expect(p).toContain('"I don\'t mind it."');
    expect(p).toContain('You knew nothing about his taste before this test.');
  });
});

describe('reading and keeping', () => {
  it('reads a session on the writer; Keep files standing lessons the writer reads every time', async () => {
    await boot();
    expect((await api('GET', '/taste/status')).body).toMatchObject({ sessions: 0, thin: true });
    const { cards } = (await api('GET', '/taste')).body;
    expect((await api('POST', '/taste/read', { session: 'sess-1', answers: answerAll(cards).slice(0, 3) })).status).toBe(400);
    const r = await api('POST', '/taste/read', { session: 'sess-1', answers: answerAll(cards), clientKey: 'tk1' });
    expect(r.status).toBe(200);
    expect(r.body.score).toMatchObject({ caught: QUOTA.planted, planted: QUOTA.planted, same: REPEATS, repeats: REPEATS });
    await svc.idle();
    const run = (await api('GET', `/runs/${r.body.runId}`)).body;
    expect(run.status).toBe('succeeded');
    expect(run.result.heard.length).toBeGreaterThan(0);
    const k = await api('POST', '/taste/keep', { runId: r.body.runId, keep: [0] });
    expect(k.body).toMatchObject({ kept: [0], added: 1 });
    expect((await api('POST', '/taste/keep', { runId: r.body.runId, keep: [0] })).body.added).toBe(0); // no duplicate lesson
    const lessons = (await api('GET', '/lessons')).body;
    expect(lessons[0]).toMatchObject({ source: 'taste', scope: 'standing', text: run.result.heard[0].rule });
    const brief = await svc.tasteFor('anything');
    expect(brief).toContain("What Sam's own picks showed in his taste test");
    expect(brief).toContain(run.result.heard[0].rule);
    expect(brief).not.toContain('from his notes on earlier ideas');
    expect((await api('GET', '/taste/status')).body).toMatchObject({ sessions: 1, kept: 1, thin: false });
    expect((await api('GET', `/runs/${r.body.runId}`)).body.result.kept).toEqual([0]);
  });

  it('his Journal songs he marks Mine become voice examples, and are not asked about again', async () => {
    await boot();
    const song = (await api('POST', '/songs', { text: 'Line one here\nLine two here\nLine three here\nLine four here' })).body;
    await api('POST', '/songs', { text: 'Too short' });
    const first = (await api('GET', '/taste')).body;
    expect(first.songs.map((s: { id: string }) => s.id)).toEqual([song.id]);
    await api('POST', '/taste/read', { session: 'sess-2', answers: answerAll(first.cards), songs: [{ id: song.id, mine: true }] }); await svc.idle();
    const voices = (await api('GET', '/voice')).body;
    expect(voices.length).toBe(1);
    expect(voices[0].text).toContain('Line four here');
    expect((await api('GET', '/taste')).body.songs).toEqual([]);
  });

  it('a page started from one of the writer\'s ideas is not asked about until he types into it', async () => {
    await boot();
    const idea = (await api('POST', '/ideas', { sourceKey: 'k1', kind: 'seed', title: 'Writer Title', concept: 'c', lines: ['one line', 'two line', 'three line', 'four line'] })).body;
    const { songId } = (await api('POST', `/ideas/${idea.id}/start`)).body;
    let ws = (await api('GET', `/songs/${songId}`)).body;
    await api('POST', `/songs/${songId}/add`, { baseRev: ws.current_rev, afterLineId: null, text: 'one line\ntwo line\nthree line\nfour line', source: 'seed', clientKey: 'seed1' });
    expect((await api('GET', '/taste')).body.songs).toEqual([]);
    ws = (await api('GET', `/songs/${songId}`)).body;
    const put = await api('PUT', `/songs/${songId}/text`, { baseRev: ws.current_rev, text: 'my own words here\ntwo line\nthree line\nfour line' });
    expect(put.status).toBe(200);
    expect((await api('GET', '/taste')).body.songs.map((x: { id: string }) => x.id)).toEqual([songId]);
  });

  it('a preview runs the real reading and saves nothing: no answers, no songs, nothing to keep', async () => {
    await boot();
    const song = (await api('POST', '/songs', { text: 'Line one here\nLine two here\nLine three here\nLine four here' })).body;
    const { cards } = (await api('GET', '/taste')).body;
    const r = await api('POST', '/taste/read', { session: 'prev-1', preview: true, answers: answerAll(cards), songs: [{ id: song.id, mine: true }] });
    await svc.idle();
    expect((await api('GET', `/runs/${r.body.runId}`)).body.result.preview).toBe(true);
    expect((await db.query(`SELECT COUNT(*) AS n FROM taste_answers`))[0]).toMatchObject({ n: 0 });
    expect((await api('GET', '/voice')).body).toEqual([]);
    expect((await api('GET', '/taste')).body.songs.length).toBe(1);
    const k = await api('POST', '/taste/keep', { runId: r.body.runId, keep: [0] });
    expect(k.status).toBe(400);
    expect((await api('GET', '/lessons')).body).toEqual([]);
  });
});
