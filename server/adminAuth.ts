import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

/**
 * Admin authentication: a single shared passcode, deliberately isolated from
 * Supabase Auth entirely (admins are not participants or counselors —
 * see the ADMIN.md note in server/adminRouter.ts for why). The passcode
 * itself lives only in ADMIN_PASSCODE (env var, never in source); it is
 * hashed once at process start and every login attempt is checked against
 * that hash via bcrypt.compare, never a plaintext string comparison.
 */

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || '';
const ADMIN_SESSION_TTL = '2h';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

let cachedPasscodeHash: string | null = null;

function getPasscodeHash(): string {
  if (cachedPasscodeHash) return cachedPasscodeHash;
  const passcode = process.env.ADMIN_PASSCODE;
  if (!passcode) {
    throw new Error('ADMIN_PASSCODE is not configured on the server.');
  }
  cachedPasscodeHash = bcrypt.hashSync(passcode, 10);
  return cachedPasscodeHash;
}

// In-memory rate limiting. This is a single-shared-passcode gate (not
// per-user credentials), so lockout state is tracked per client IP rather
// than per account. Resets on server restart — acceptable for this
// prototype's scale; a production deployment behind multiple instances
// would move this to Redis or the database instead.
interface AttemptRecord {
  failedCount: number;
  lockedUntil: number | null;
}
const attemptsByIp = new Map<string, AttemptRecord>();

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

export function checkAdminLockout(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const record = attemptsByIp.get(ip);
  if (record?.lockedUntil && record.lockedUntil > Date.now()) {
    const minutesLeft = Math.ceil((record.lockedUntil - Date.now()) / 60000);
    return res.status(429).json({
      detail: `Too many failed passcode attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
    });
  }
  next();
}

export function recordFailedAttempt(req: Request) {
  const ip = getClientIp(req);
  const record = attemptsByIp.get(ip) || { failedCount: 0, lockedUntil: null };
  record.failedCount += 1;
  if (record.failedCount >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MS;
    record.failedCount = 0;
  }
  attemptsByIp.set(ip, record);
}

export function clearFailedAttempts(req: Request) {
  attemptsByIp.delete(getClientIp(req));
}

export function verifyPasscode(candidate: string): boolean {
  return bcrypt.compareSync(candidate, getPasscodeHash());
}

export function issueAdminToken(): string {
  if (!ADMIN_JWT_SECRET) {
    throw new Error('ADMIN_JWT_SECRET is not configured on the server.');
  }
  return jwt.sign({ role: 'admin' }, ADMIN_JWT_SECRET, { expiresIn: ADMIN_SESSION_TTL });
}

export interface AdminRequest extends Request {
  isAdmin?: boolean;
}

export function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = typeof authHeader === 'string' ? authHeader.split(' ')[1] : undefined;
  if (!token || !ADMIN_JWT_SECRET) {
    return res.status(401).json({ detail: 'Admin session required.' });
  }
  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET) as { role?: string };
    if (payload.role !== 'admin') throw new Error('wrong role');
    req.isAdmin = true;
    next();
  } catch {
    return res.status(401).json({ detail: 'Admin session expired or invalid. Please log in again.' });
  }
}
