import 'server-only';

import { getDataMode, getSupabase, withSupabaseDeadline } from './supabase-server';
import { pgQuery } from './postgres';

type Session = { tokenHash: string; credentialVersion: string; expiresAt: number };
type Attempt = { count: number; resetsAt: number };
const windowMs = 15 * 60 * 1000;

export function localAdminAuthAllowed() {
  return process.env.NODE_ENV !== 'production' && process.env.ADMIN_LOCAL_AUTH === 'true';
}

// This opt-in store is only for a single development process. Restart revokes its sessions.
// Cloud deployments always use PostgreSQL, including during a database outage.
const runtime = globalThis as typeof globalThis & {
  hlLocalAdminSessions?: Map<string, Session>;
  hlLocalLoginAttempts?: Map<string, Attempt>;
};

const localStore = {
  async createSession(session: Session) {
    const sessions = runtime.hlLocalAdminSessions ??= new Map();
    for (const [key, value] of sessions) if (value.expiresAt <= Date.now()) sessions.delete(key);
    if (sessions.size >= 10000) throw new Error('Local authentication storage is full.');
    sessions.set(session.tokenHash, session);
  },
  async hasSession(tokenHash: string, credentialVersion: string) {
    const session = runtime.hlLocalAdminSessions?.get(tokenHash);
    return !!session && session.credentialVersion === credentialVersion && session.expiresAt > Date.now();
  },
  async revokeSession(tokenHash: string) { runtime.hlLocalAdminSessions?.delete(tokenHash); },
  async reserveAttempt(sourceHash: string, admin: boolean) {
    const attempts = runtime.hlLocalLoginAttempts ??= new Map();
    const now = Date.now();
    for (const [key, value] of attempts) if (value.resetsAt <= now) attempts.delete(key);
    const buckets = [{ key: `source:${sourceHash}`, limit: 5 }, ...(admin ? [{ key: 'account:admin', limit: 30 }] : [])];
    let retryAfter = 0;
    for (const { key, limit } of buckets) {
      const value = attempts.get(key);
      if (value && value.count >= limit) retryAfter = Math.max(retryAfter, Math.ceil((value.resetsAt - now) / 1000));
    }
    if (retryAfter) return retryAfter;
    if (attempts.size >= 10000) throw new Error('Local authentication storage is full.');
    // No await between checking and consuming: atomic within the one supported process.
    for (const { key } of buckets) {
      const value = attempts.get(key) ?? { count: 0, resetsAt: now + windowMs };
      value.count += 1;
      attempts.set(key, value);
    }
    return 0;
  },
};

const cloudStore: typeof localStore = {
  async createSession(session) {
    const { error } = await withSupabaseDeadline(() => getSupabase().from('admin_sessions').insert({
      token_hash: session.tokenHash, credential_version: session.credentialVersion,
      expires_at: new Date(session.expiresAt).toISOString(),
    }));
    if (error) throw new Error('Could not persist administrator session.');
  },
  async hasSession(tokenHash, credentialVersion) {
    const { data, error } = await withSupabaseDeadline(() => getSupabase().from('admin_sessions').select('token_hash')
      .eq('token_hash', tokenHash).eq('credential_version', credentialVersion)
      .gt('expires_at', new Date().toISOString()).maybeSingle());
    if (error) throw new Error('Could not verify administrator session.');
    return !!data;
  },
  async revokeSession(tokenHash) {
    const { error } = await withSupabaseDeadline(() => getSupabase().from('admin_sessions').delete().eq('token_hash', tokenHash));
    if (error) throw new Error('Could not revoke administrator session.');
  },
  async reserveAttempt(sourceHash, admin) {
    const { data, error } = await withSupabaseDeadline(() => getSupabase().rpc('reserve_admin_login_attempt', { p_source: sourceHash, p_admin: admin }));
    if (error || !Number.isInteger(data) || data < 0 || data > 900) throw new Error('Could not reserve login attempt.');
    return data as number;
  },
};

const postgresStore: typeof localStore = {
  async createSession(session) {
    await pgQuery('insert into public.admin_sessions(token_hash,credential_version,expires_at) values($1,$2,$3)', [session.tokenHash, session.credentialVersion, new Date(session.expiresAt)]);
  },
  async hasSession(tokenHash, credentialVersion) {
    const { rowCount } = await pgQuery('select token_hash from public.admin_sessions where token_hash=$1 and credential_version=$2 and expires_at>now()', [tokenHash, credentialVersion]);
    return !!rowCount;
  },
  async revokeSession(tokenHash) { await pgQuery('delete from public.admin_sessions where token_hash=$1', [tokenHash]); },
  async reserveAttempt(sourceHash, admin) {
    const { rows } = await pgQuery('select public.reserve_admin_login_attempt($1,$2) as retry', [sourceHash, admin]);
    const retry = rows[0]?.retry;
    if (!Number.isInteger(retry) || retry < 0 || retry > 900) throw new Error('Could not reserve login attempt.');
    return retry as number;
  },
};

export function getAdminAuthStore() {
  if (getDataMode() === 'postgres') return postgresStore;
  if (getDataMode() === 'supabase') return cloudStore;
  if (localAdminAuthAllowed()) return localStore;
  throw new Error('A shared authentication store is required.');
}
