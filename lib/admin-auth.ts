import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const sessionCookie = 'hl-admin-session';
export const sessionDuration = 60 * 60 * 12;
// Development fallback survives hot reloads; configure ADMIN_SESSION_SECRET for multiple server instances.
const runtime = globalThis as typeof globalThis & { hlAdminSecret?: string };
const secret = process.env.ADMIN_SESSION_SECRET || (runtime.hlAdminSecret ??= randomBytes(32).toString('hex'));

function signature(payload: string) { return createHmac('sha256', secret).update(payload).digest('hex'); }
function equal(a: string, b: string) {
  const first = Buffer.from(a); const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

export function validCredentials(username: string, password: string) {
  return equal(username, 'admin') && equal(password, process.env.ADMIN_PASSWORD || '123456!');
}

export function createSession() {
  const payload = `admin:${Date.now() + sessionDuration * 1000}:${randomBytes(16).toString('hex')}`;
  return `${payload}.${signature(payload)}`;
}

export async function isAdmin() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return false;
  const [payload, mac, extra] = token.split('.');
  if (!payload || !mac || extra !== undefined || !equal(mac, signature(payload))) return false;
  const [user, expires] = payload.split(':');
  return user === 'admin' && Number(expires) > Date.now();
}
