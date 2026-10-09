import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import { z } from 'zod';
import { Service, AppError } from './service.js';
import { type AuthConfig, requireAuth, checkPassword, makeSession, setSessionCookie, validSession, readCookie } from './auth.js';
import { MODELS, RATES } from './engine/writer.js';
import { startBatch, latestResults, vote } from './evals.js';

const targetZ = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('line'), lineId: z.string().max(40), expected: z.string().max(2000) }),
  z.object({ kind: z.literal('span'), lineId: z.string().max(40), start: z.number().int().min(0), end: z.number().int().min(1), expected: z.string().max(2000) }),
]);
const key = z.string().max(80).nullable().optional();

type H = (req: Request, res: Response) => Promise<unknown>;

export function createApp(svc: Service, auth: AuthConfig, opts: { staticDir?: string; writerLabel: string; writerLive: boolean }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });

  const h = (fn: H) => (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).then((out) => { if (!res.headersSent) res.json(out ?? { ok: true }); }).catch(next);
  };

  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  app.post('/api/login', (req, res) => {
    const pw = typeof req.body?.password === 'string' ? req.body.password : '';
    const r = checkPassword(auth, req.ip ?? 'x', pw);
    if (r === 'unset') return res.status(503).json({ error: { code: 'no_password', message: 'APP_PASSWORD is not set on the server.' } });
    if (r === 'locked') return res.status(429).json({ error: { code: 'locked', message: 'Too many attempts. Try again in 10 minutes.' } });
    if (r === 'wrong') return res.status(401).json({ error: { code: 'wrong', message: 'Wrong password.' } });
    setSessionCookie(res, auth, makeSession(auth));
    res.json({ ok: true });
  });
  app.post('/api/logout', (_req, res) => { setSessionCookie(res, auth, null); res.json({ ok: true }); });
  app.get('/api/session', (req, res) => res.json({ signedIn: validSession(auth, readCookie(req)) }));

  const api = express.Router();
  api.use(requireAuth(auth));

  api.get('/status', h(async () => ({
    writer: { connected: !!svc.writer, live: opts.writerLive, label: opts.writerLabel },
    settings: await svc.settings(), spend: await svc.spend(), models: MODELS, rates: RATES,
  })));

  // Writing
  api.get('/threads', h(async () => svc.threads()));
  api.get('/threads/:id', h(async (req) => {
    const t = await svc.thread(String(req.params.id));
    const runIds = (t.messages as Array<{ run_id: string | null }>).map((m) => m.run_id).filter((x): x is string => !!x);
    return { ...t, saved: await svc.savedKeys(runIds) };
  }));
  api.delete('/threads/:id', h(async (req) => svc.deleteThread(String(req.params.id))));
  api.post('/messages', h(async (req) => {
    const b = z.object({ threadId: z.string().max(40).nullable().optional(), songId: z.string().max(40).nullable().optional(), text: z.string().max(20000),
      reference: z.string().max(2000).nullable().optional(), focus: z.string().max(4000).nullable().optional(), clientKey: key }).parse(req.body);
    return svc.sendMessage({ threadId: b.threadId ?? null, songId: b.songId ?? null, text: b.text, reference: b.reference, focus: b.focus, clientKey: b.clientKey ?? null });
  }));
  api.get('/runs/:id', h(async (req) => svc.getRun(String(req.params.id))));
  api.post('/runs/:id/cancel', h(async (req) => svc.cancelRun(String(req.params.id))));

  // Journal
  api.get('/journal', h(async (req) => svc.journal(String(req.query.q ?? ''), ['all', 'songs', 'seeds', 'lines', 'starred'].includes(String(req.query.filter)) ? String(req.query.filter) : 'all')));
  api.post('/ideas', h(async (req) => {
    const b = z.object({ sourceKey: z.string().max(120).nullable(), kind: z.enum(['seed', 'line']), title: z.string().max(200), concept: z.string().max(2000),
      lines: z.array(z.string().max(1000)).max(40), sourceRunId: z.string().max(40).nullable().optional() }).parse(req.body);
    return svc.saveIdea(b);
  }));
  api.get('/ideas/:id', h(async (req) => svc.idea(String(req.params.id))));
  api.patch('/ideas/:id', h(async (req) => {
    const b = z.object({ title: z.string().max(200).optional(), concept: z.string().max(4000).optional(), lines: z.array(z.string().max(1000)).max(80).optional(),
      notes: z.string().max(20000).optional(), starred: z.boolean().optional(), archived: z.boolean().optional() }).parse(req.body);
    return svc.updateIdea(String(req.params.id), b);
  }));
  api.delete('/ideas/:id', h(async (req) => svc.deleteIdea(String(req.params.id))));

  // Songs
  api.post('/songs', h(async (req) => {
    const b = z.object({ title: z.string().max(200).optional(), text: z.string().max(30000).optional(), ideaId: z.string().max(40).nullable().optional() }).parse(req.body);
    return svc.createSong(b);
  }));
  api.get('/songs/:id', h(async (req) => svc.song(String(req.params.id))));
  api.patch('/songs/:id', h(async (req) => {
    const b = z.object({ title: z.string().max(200).optional(), brief: z.string().max(8000).optional(), notes: z.string().max(20000).optional(),
      starred: z.boolean().optional(), archived: z.boolean().optional(), locks: z.array(z.string().max(40)).max(500).optional() }).parse(req.body);
    return svc.updateSong(String(req.params.id), b);
  }));
  api.delete('/songs/:id', h(async (req) => svc.deleteSong(String(req.params.id))));
  api.get('/songs/:id/revisions', h(async (req) => svc.revisions(String(req.params.id))));
  api.put('/songs/:id/text', h(async (req) => {
    const b = z.object({ baseRev: z.number().int(), text: z.string().max(30000) }).parse(req.body);
    return svc.saveText(String(req.params.id), b.baseRev, b.text);
  }));
  api.post('/songs/:id/edit', h(async (req) => {
    const b = z.object({ baseRev: z.number().int(), targets: z.array(targetZ).max(40), instruction: z.string().max(4000), clientKey: key, count: z.number().int().min(1).max(8).optional() }).parse(req.body);
    return svc.edit(String(req.params.id), { ...b, clientKey: b.clientKey ?? null });
  }));
  api.post('/songs/:id/accept', h(async (req) => {
    const b = z.object({ baseRev: z.number().int(), replacements: z.array(z.object({ lineId: z.string().max(40), newText: z.string().max(2000) })).min(1).max(80),
      source: z.enum(['direct', 'writer']), runId: z.string().max(40).nullable().optional(), note: z.string().max(300).optional() }).parse(req.body);
    return svc.accept(String(req.params.id), b.baseRev, b.replacements, b.source, b.runId ?? null, b.note ?? '');
  }));
  api.post('/songs/:id/draft', h(async (req) => {
    const b = z.object({ baseRev: z.number().int(), sections: z.array(z.object({ label: z.string().max(60), lines: z.array(z.string().max(1000)).max(80) })).max(40), runId: z.string().max(40).nullable().optional() }).parse(req.body);
    return svc.acceptDraft(String(req.params.id), b.baseRev, b.sections, b.runId ?? null);
  }));
  api.post('/songs/:id/restore', h(async (req) => {
    const b = z.object({ rev: z.number().int(), baseRev: z.number().int() }).parse(req.body);
    return svc.restore(String(req.params.id), b.rev, b.baseRev);
  }));
  api.post('/songs/:id/suno', h(async (req) => {
    const b = z.object({ hint: z.string().max(2000).default(''), clientKey: key }).parse(req.body);
    return svc.suno(String(req.params.id), { hint: b.hint, clientKey: b.clientKey ?? null });
  }));

  // Settings
  api.patch('/settings', h(async (req) => {
    const b = z.object({ model: z.string().optional(), effortCreative: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(), effortEdit: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(),
      dailyCapUsd: z.number().optional(), monthlyCapUsd: z.number().optional(), taste: z.string().optional() }).parse(req.body);
    return svc.updateSettings(b);
  }));
  api.get('/receipts', h(async () => svc.receipts()));
  api.get('/voice', h(async () => svc.voiceExamples()));
  api.post('/voice', h(async (req) => {
    const b = z.object({ direction: z.string().max(80).default(''), text: z.string().max(6000) }).parse(req.body);
    return svc.addVoice(b.direction, b.text);
  }));
  api.delete('/voice/:id', h(async (req) => svc.deleteVoice(String(req.params.id))));

  // Test pack
  api.get('/evals', h(async () => latestResults(svc)));
  api.post('/evals/run', h(async (req) => {
    const b = z.object({ ids: z.array(z.string().max(4)).max(20).default([]) }).parse(req.body);
    return startBatch(svc, b.ids);
  }));
  api.post('/evals/:id/vote', h(async (req) => {
    const b = z.object({ vote: z.enum(['use', 'maybe', 'no']).nullable() }).parse(req.body);
    return vote(svc, String(req.params.id), b.vote);
  }));

  // Export
  api.get('/export.json', async (_req, res, next) => {
    try {
      const data = await svc.exportAll();
      res.setHeader('Content-Disposition', `attachment; filename="songroom-backup-${new Date().toISOString().slice(0, 10)}.json"`);
      res.json(data);
    } catch (e) { next(e); }
  });
  api.get('/export.md', async (_req, res, next) => {
    try {
      const md = await svc.exportMarkdown();
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="songroom-journal-${new Date().toISOString().slice(0, 10)}.md"`);
      res.send(md);
    } catch (e) { next(e); }
  });

  app.use('/api', api);
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'Not found.' } }));

  if (opts.staticDir) {
    app.use(express.static(opts.staticDir, { index: false, maxAge: '1h', setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-store'); } }));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(opts.staticDir!, 'index.html')));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) return res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.extra } });
    if (err instanceof z.ZodError) return res.status(400).json({ error: { code: 'bad_request', message: 'That request was malformed.' } });
    if ((err as { type?: string }).type === 'entity.too.large') return res.status(413).json({ error: { code: 'too_large', message: 'That is too large.' } });
    const ref = Math.random().toString(36).slice(2, 8);
    console.error(`[${ref}]`, err);
    res.status(500).json({ error: { code: 'internal', message: `Something went wrong (ref ${ref}). Nothing was lost.` } });
  });

  return app;
}
