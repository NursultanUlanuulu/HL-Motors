'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminAuthConfigured, adminConfigurationError, adminRateLimitError, adminUnavailableError, createSession, isAdmin, reserveLoginAttempt, revokeSession, sessionCookie, sessionDuration, validCredentials } from '@/lib/admin-auth';
import { withSupabaseDeadline } from '@/lib/supabase-server';

export async function login(_state: { error: string }, form: FormData) {
  const username = String(form.get('username') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!adminAuthConfigured()) return { error: adminConfigurationError };
  try {
    const result = await withSupabaseDeadline(async () => {
      if (await reserveLoginAttempt(username, await headers())) return { error: adminRateLimitError };
      if (!validCredentials(username, password)) return { error: 'Неверный логин или пароль.' };
      return { token: await createSession() };
    });
    if ('error' in result) return { error: result.error! };
    (await cookies()).set(sessionCookie, result.token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: sessionDuration,
    });
  } catch { return { error: adminUnavailableError }; }
  redirect('/admin/vehicles');
}

export async function logout() {
  const jar = await cookies();
  try { await revokeSession(jar.get(sessionCookie)?.value); }
  catch { throw new Error('Не удалось завершить сеанс. Попробуйте выйти ещё раз.'); }
  jar.delete(sessionCookie);
  redirect('/login');
}

export async function ensureAdminSession() {
  return isAdmin();
}
