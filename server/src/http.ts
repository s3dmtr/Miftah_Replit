import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { one } from './db.js';
import type { Role } from '../../src/types.ts';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string, public extra?: Record<string, unknown>) {
    super(message ?? code);
  }
}

export interface AuthUser { id: string; role: Role; advertiserId: string | null; nameAr: string; nameEn: string; email: string }
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user?: AuthUser } }
}

const SECRET = () => process.env.JWT_SECRET || 'dev-only-secret';
export const sign = (userId: string) => jwt.sign({ sub: userId }, SECRET(), { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] });

/** Async wrapper so thrown errors reach the central handler. */
export const h = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res).catch(next); };

/** Reads the Bearer token if present. Never rejects; use requireAuth/requireRole for that. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const hdr = req.headers.authorization;
  if (!hdr?.startsWith('Bearer ')) return next();
  let sub: string;
  try { sub = (jwt.verify(hdr.slice(7), SECRET()) as jwt.JwtPayload).sub as string; }
  catch { return next(new HttpError(401, 'invalid_token', 'Token is invalid or expired')); }
  one(`SELECT id, role, advertiser_id AS "advertiserId", name_ar AS "nameAr", name_en AS "nameEn", email FROM users WHERE id = $1`, [sub])
    .then((u) => { if (!u) throw new HttpError(401, 'invalid_token', 'User no longer exists'); req.user = u; next(); })
    .catch(next);
};

export const requireAuth: RequestHandler = (req, _res, next) =>
  next(req.user ? undefined : new HttpError(401, 'unauthenticated', 'Sign in required'));

export const requireRole = (...roles: Role[]): RequestHandler => (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'unauthenticated', 'Sign in required'));
  next(roles.includes(req.user.role) ? undefined : new HttpError(403, 'forbidden', `Requires role: ${roles.join(', ')}`));
};
export const ADVERTISER_ROLES: Role[] = ['owner', 'company', 'marketer'];
export const STAFF_ROLES: Role[] = ['admin', 'supervisor'];

export const parse = <S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> => schema.parse(data);

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, message: err.message, ...err.extra });
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'validation_error', message: 'Invalid request', issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  }
  const pg = err as { code?: string; constraint?: string; detail?: string };
  if (pg.code === '23505') return res.status(409).json({ error: pg.constraint === 'listings_one_live_ad_per_land_code' ? 'duplicate' : 'conflict', message: pg.detail ?? 'Already exists' });
  if (pg.code === '23503' || pg.code === '23514' || pg.code === '22P02') return res.status(400).json({ error: 'bad_reference', message: pg.detail ?? 'Invalid reference or value' });
  if ((err as { type?: string }).type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json', message: 'Body is not valid JSON' });
  console.error(err);
  return res.status(500).json({ error: 'internal_error', message: 'Something went wrong' });
}
