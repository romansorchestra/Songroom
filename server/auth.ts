// One owner, one password. A signed cookie proves you logged in.

import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const COOKIE = 'songroom_session';
const MAX_AGE_DAYS = 120;

export type AuthConfig = { password: string | null; secret: string; secure: boolean };

function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function makeSession(cfg: AuthConfig): string {
  const payload = `owner.${Date.now()}.${randomBytes(8).toString('base64url')}`;
  return `${payload}.${sign(cfg.secret, payload)}`;
}

export function validSession(cfg: AuthConfig, value: string | undefined): boolean {
  if (!value) return false;
  const i = value.lastIndexOf('.');
  if (i < 0) return false;
  const payload = value.slice(0, i), sig = value.slice(i + 1);
  if (!safeEqual(sig, sign(cfg.secret, payload))) return false;
  const issued = Number(payload.split('.')[1]);
  return Number.isFinite(issued) && Date.now() - issued < MAX_AGE_DAYS * 864e5;
}

export function readCookie(req: Request, name = COOKIE): string | undefined {
  const header = req.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function setSessionCookie(res: Response, cfg: AuthConfig, value: string | null) {
  const parts = [
    `${COOKIE}=${value ? encodeURIComponent(value) : ''}`,
    'Path=/', 'HttpOnly', 'SameSite=Lax',
    value ? `Max-Age=${MAX_AGE_DAYS * 86400}` : 'Max-Age=0',
  ];
  if (cfg.secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

const attempts = new Map<string, { n: number; until: number }>();

export function checkPassword(cfg: AuthConfig, ip: string, given: string): 'ok' | 'wrong' | 'locked' | 'unset' {
  if (!cfg.password) return 'unset';
  const a = attempts.get(ip);
  if (a && a.until > Date.now()) return 'locked';
  if (safeEqual(sign(cfg.secret, given), sign(cfg.secret, cfg.password))) {
    attempts.delete(ip);
    return 'ok';
  }
  const n = (a?.n ?? 0) + 1;
  attempts.set(ip, { n, until: n >= 5 ? Date.now() + 10 * 60_000 : 0 });
  return 'wrong';
}

/** Require a session on /api (except login) and a custom header on writes (CSRF guard). */
export function requireAuth(cfg: AuthConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!validSession(cfg, readCookie(req))) return res.status(401).json({ error: { code: 'signed_out', message: 'Please sign in.' } });
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-songroom'] !== '1')
      return res.status(403).json({ error: { code: 'bad_origin', message: 'Request blocked.' } });
    next();
  };
}
