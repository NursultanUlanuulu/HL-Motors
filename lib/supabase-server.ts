import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { DataMode } from './cloud-validation';
import { DataError } from './cloud-validation';

export function getDataMode(): DataMode {
  return process.env.SUPABASE_URL || process.env.SUPABASE_SECRET_KEY ? 'supabase' : 'local';
}

export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new DataError('Заполните SUPABASE_URL и SUPABASE_SECRET_KEY на сервере.', 503);
  if ((process.env.ADMIN_SESSION_SECRET?.length ?? 0) < 32) throw new DataError('Задайте ADMIN_SESSION_SECRET длиной не менее 32 символов на сервере.', 503);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(20000) }) },
  });
}
