import 'server-only';

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { cookies } from 'next/headers';
import { getAdminAuthStore, localAdminAuthAllowed } from './admin-auth-store';
import { getDataMode } from './supabase-server';

export const sessionCookie = 'hl-admin-session';
export const sessionDuration = 60 * 60 * 12;
export const adminConfigurationError = 'Вход администратора не настроен. Обратитесь к владельцу сайта.';
export const adminUnavailableError = 'Сервис входа временно недоступен. Попробуйте позже.';
export const adminRateLimitError = 'Слишком много попыток входа. Попробуйте через 15 минут.';

const runtime = globalThis as typeof globalThis & { hlLocalAdminSecret?: string };

export function strongAdminPassword(password: string | undefined): password is string {
  return typeof password === 'string' && password.length >= 16 && password.length <= 256
    && /\p{L}/u.test(password) && /\p{N}/u.test(password) && /[^\p{L}\p{N}\s]/u.test(password);
}

function configuration() {
  const password = process.env.ADMIN_PASSWORD;
  if (!strongAdminPassword(password)) throw new Error(adminConfigurationError);
  const cloud = getDataMode() !== 'local';
  if (!cloud && !localAdminAuthAllowed()) throw new Error(adminConfigurationError);
  const configuredSecret = process.env.ADMIN_SESSION_SECRET;
  if ((cloud || configuredSecret) && (configuredSecret?.length ?? 0) < 32) throw new Error(adminConfigurationError);
  const secret = configuredSecret || (runtime.hlLocalAdminSecret ??= randomBytes(32).toString('hex'));
  const hmac = (purpose: string, value: string) => createHmac('sha256', secret).update(`${purpose}:${value}`).digest('hex');
  return { password, hmac, credentialVersion: hmac('credentials', password) };
}

export function adminAuthConfigured() {
  try { configuration(); return true; } catch { return false; }
}

function equal(a: string, b: string) {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

export function validCredentials(username: string, password: string) {
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 100 || password.length > 256) return false;
  try {
    const expected = configuration().password;
    const userMatches = equal(username, 'admin');
    const passwordMatches = equal(password, expected);
    return userMatches && passwordMatches;
  } catch { return false; }
}

// Trust a client IP header only when the deployment's proxy overwrites it.
// With no such contract configured, every request shares a conservative source bucket.
function loginSource(headers: Pick<Headers, 'get'>) {
  const header = process.env.ADMIN_TRUSTED_IP_HEADER?.toLowerCase();
  if (!header || !/^[a-z0-9-]+$/.test(header)) return 'unknown';
  const candidate = headers.get(header)?.split(',')[0].trim();
  return candidate && isIP(candidate) ? candidate : 'unknown';
}

export async function reserveLoginAttempt(username: string, headers: Pick<Headers, 'get'>) {
  const config = configuration();
  return getAdminAuthStore().reserveAttempt(config.hmac('login-source', loginSource(headers)), username === 'admin');
}

export async function createSession() {
  const config = configuration();
  const token = randomBytes(32).toString('hex');
  await getAdminAuthStore().createSession({
    tokenHash: config.hmac('session', token), credentialVersion: config.credentialVersion,
    expiresAt: Date.now() + sessionDuration * 1000,
  });
  return token;
}

export async function revokeSession(token: string | undefined) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return;
  const config = configuration();
  await getAdminAuthStore().revokeSession(config.hmac('session', token));
}

export async function isAdmin() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  try {
    const config = configuration();
    return await getAdminAuthStore().hasSession(config.hmac('session', token), config.credentialVersion);
  } catch { return false; }
}
