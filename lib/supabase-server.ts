import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createClient } from '@supabase/supabase-js';
import type { DataMode } from './cloud-validation';
import { DataError } from './cloud-validation';
import { withDeadline, serverRequestTimeoutMs, type DeadlineOptions } from './request-deadline';

const operationSignal = new AsyncLocalStorage<AbortSignal>();

export function withSupabaseDeadline<T>(operation: (signal: AbortSignal) => PromiseLike<T>, options: DeadlineOptions = {}) {
  const parent = operationSignal.getStore();
  const signal = parent && options.signal ? AbortSignal.any([parent, options.signal]) : parent ?? options.signal;
  return withDeadline(signal => operationSignal.run(signal, () => operation(signal)), { ...options, signal });
}

export function getDataMode(): DataMode {
  return process.env.SUPABASE_URL || process.env.SUPABASE_SECRET_KEY ? 'supabase' : 'local';
}

export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new DataError('Заполните SUPABASE_URL и SUPABASE_SECRET_KEY на сервере.', 503);
  if ((process.env.ADMIN_SESSION_SECRET?.length ?? 0) < 32) throw new DataError('Задайте ADMIN_SESSION_SECRET длиной не менее 32 символов на сервере.', 503);
  // Direct repository callers also share one deadline across pagination.
  const deadline = operationSignal.getStore() ?? AbortSignal.timeout(serverRequestTimeoutMs);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { retry: false },
    global: { fetch: (input, init) => {
      const signals = [deadline];
      if (init?.signal) signals.push(init.signal);
      if (input instanceof Request) signals.push(input.signal);
      const signal = AbortSignal.any(signals);
      signal.throwIfAborted();
      return fetch(input, { ...init, cache: 'no-store', signal });
    } },
  });
}
