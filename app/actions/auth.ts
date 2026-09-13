'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSession, isAdmin, sessionCookie, sessionDuration, validCredentials } from '@/lib/admin-auth';

export async function login(_state: { error: string }, form: FormData) {
  const username = String(form.get('username') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!validCredentials(username, password)) return { error: 'Неверный логин или пароль.' };
  (await cookies()).set(sessionCookie, createSession(), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: sessionDuration,
  });
  redirect('/admin/vehicles');
}

export async function logout() {
  (await cookies()).delete(sessionCookie);
  redirect('/login');
}

export async function ensureAdminSession() {
  return isAdmin();
}
