import 'server-only';
import { isAdmin } from './admin-auth';
import { DataError } from './cloud-validation';
import { withDeadline, timeoutMessage, type DeadlineOptions } from './request-deadline';

const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
export const maxJsonBytes = 256_000;

function parseOrigin(value: string): URL | undefined {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value) return;
    return url;
  } catch { return; }
}

function allowedOrigin(request: Request, origin: string): boolean {
  if (!parseOrigin(origin)) return false;
  const configured = process.env.ADMIN_ALLOWED_ORIGINS;
  if (configured?.trim()) {
    const origins = configured.split(',').map(value => value.trim());
    // An invalid setting fails closed instead of silently widening the policy.
    return origins.every(value => parseOrigin(value)) && origins.includes(origin);
  }
  const requestUrl = new URL(request.url);
  const rawHost = request.headers.get('host');
  if (!rawHost) return origin === requestUrl.origin;
  const external = parseOrigin(`${requestUrl.protocol}//${rawHost}`);
  if (!external) return false;
  const sameHost = external.host === requestUrl.host;
  // NextURL rewrites loopback addresses to localhost; only undo that exact
  // normalization using Host. Forwarded headers never establish trust.
  const normalizedLoopback = requestUrl.hostname === 'localhost'
    && loopbackHosts.has(external.hostname) && external.port === requestUrl.port;
  return (sameHost || normalizedLoopback) && origin === external.origin;
}

export async function requireAdmin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigin(request, origin)) throw new DataError('Недопустимый источник запроса.', 403);
  if (!await isAdmin()) throw new DataError('Сессия завершена. Войдите в админку снова.', 401);
}

export async function readJson(request: Request, allowedKeys?: readonly string[], options: DeadlineOptions = {}): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') throw new DataError('Ожидается JSON.');
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) throw new DataError('Некорректный запрос.');
  if (length && Number(length) > maxJsonBytes) throw new DataError('Запрос слишком большой.', 413);
  if (!request.body) throw new DataError('Некорректный запрос.');
  const reader = request.body.getReader();
  try {
    return await withDeadline(async signal => {
      const cancel = () => { void reader.cancel(signal.reason).catch(() => {}); };
      signal.addEventListener('abort', cancel, { once: true });
      try {
        let size = 0;
        const chunks: Uint8Array[] = [];
        for (;;) {
          const { done, value } = await reader.read();
          signal.throwIfAborted();
          if (done) break;
          size += value.byteLength;
          if (size > maxJsonBytes) throw new DataError('Запрос слишком большой.', 413);
          chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        let result: unknown;
        try { result = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
        catch { throw new DataError('Некорректный запрос.'); }
        if (!result || typeof result !== 'object' || Array.isArray(result) || Object.getPrototypeOf(result) !== Object.prototype) throw new DataError('Некорректный запрос.');
        if (allowedKeys && Object.keys(result).some(key => !allowedKeys.includes(key))) throw new DataError('Некорректный запрос.');
        return result as Record<string, unknown>;
      } finally { signal.removeEventListener('abort', cancel); }
    }, { signal: options.signal ? AbortSignal.any([request.signal, options.signal]) : request.signal, timeoutMs: options.timeoutMs ?? 10_000 });
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
}

export function apiError(error: unknown) {
  if (error instanceof DataError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error && error.name === 'TimeoutError') return Response.json({ error: timeoutMessage }, { status: 504 });
  // Never return database diagnostics or credentials to a browser.
  return Response.json({ error: 'Не удалось выполнить запрос к Supabase. Проверьте подключение и схему базы.' }, { status: 503 });
}
