import type { Car } from './cars';
import type { Contacts } from './site-data';
import { withDeadline, clientRequestTimeoutMs, mediaUploadTimeoutMs, type DeadlineOptions } from './request-deadline';

export const connectionErrorMessage = 'Не удалось связаться с сервером. Проверьте подключение и повторите попытку.';

async function fetchWithConnectionError(url: string, init: RequestInit & { signal: AbortSignal }) {
  try { return await fetch(url, init); }
  catch {
    init.signal.throwIfAborted();
    throw new Error(connectionErrorMessage);
  }
}

export async function apiRequest<T>(url: string, body?: unknown, method = 'POST', options: DeadlineOptions = {}): Promise<T> {
  return withDeadline(async signal => {
    const response = await fetchWithConnectionError(url, {
      method: body === undefined ? 'GET' : method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal,
    });
    let result;
    try { result = await response.json(); }
    catch {
      signal.throwIfAborted();
      throw new Error(connectionErrorMessage);
    }
    signal.throwIfAborted();
    if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : connectionErrorMessage);
    return result as T;
  }, { ...options, timeoutMs: options.timeoutMs ?? clientRequestTimeoutMs });
}

export type CloudSnapshot = { cars: Car[]; contacts: Contacts };

export async function uploadCloudMedia(files: File[], options: DeadlineOptions = {}) {
  const sources: string[] = [];
  for (const file of files) {
    const source = await withDeadline(async signal => {
      const { uploadUrl, publicUrl } = await apiRequest<{ uploadUrl: string; publicUrl: string }>('/api/admin/media', { type: file.type, size: file.size }, 'POST', { signal });
      const body = new FormData();
      body.append('cacheControl', '31536000');
      body.append('', file);
      const response = await fetchWithConnectionError(uploadUrl, { method: 'PUT', body, signal });
      if (!response.ok) throw new Error('Не удалось загрузить файл в Supabase Storage. Повторите попытку.');
      return publicUrl;
    }, { ...options, timeoutMs: options.timeoutMs ?? mediaUploadTimeoutMs });
    sources.push(source);
  }
  return sources;
}
