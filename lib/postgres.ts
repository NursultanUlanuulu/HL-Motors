import 'server-only';
import { Pool, type QueryResultRow } from 'pg';
import { currentDataSignal } from './supabase-server';
import { withDeadline } from './request-deadline';

const runtime = globalThis as typeof globalThis & { hlPostgresPool?: Pool };
function pool() {
  if (!process.env.DATABASE_URL) throw new Error('PostgreSQL is not configured.');
  if (!runtime.hlPostgresPool) {
    runtime.hlPostgresPool = new Pool({
      connectionString: process.env.DATABASE_URL, max: 8,
      connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
      statement_timeout: 18000, lock_timeout: 5000,
      application_name: 'hl-motors',
    });
    // Do not log connection errors with credentials or crash on an idle disconnect.
    runtime.hlPostgresPool.on('error', () => {});
  }
  return runtime.hlPostgresPool;
}

export async function pgQuery<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) {
  return withDeadline(async signal => {
    const client = await pool().connect();
    let released = false;
    const abort = () => { if (!released) { released = true; client.release(true); } };
    signal.addEventListener('abort', abort, { once: true });
    try {
      signal.throwIfAborted();
      const result = await client.query<T>(sql, values);
      signal.throwIfAborted();
      return result;
    } finally {
      signal.removeEventListener('abort', abort);
      if (!released) client.release(signal.aborted);
    }
  }, { signal: currentDataSignal() });
}
