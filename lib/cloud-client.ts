import type { Car } from './cars';
import type { Contacts } from './site-data';

export async function apiRequest<T>(url: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? 'GET' : method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Не удалось связаться с сервером. Повторите попытку.');
  return result as T;
}

export type CloudSnapshot = { cars: Car[]; contacts: Contacts };

export async function uploadCloudMedia(files: File[]) {
  const sources: string[] = [];
  for (const file of files) {
    const { uploadUrl, publicUrl } = await apiRequest<{ uploadUrl: string; publicUrl: string }>('/api/admin/media', { type: file.type, size: file.size });
    const body = new FormData();
    body.append('cacheControl', '31536000');
    body.append('', file);
    const response = await fetch(uploadUrl, { method: 'PUT', body });
    if (!response.ok) throw new Error('Не удалось загрузить файл в Supabase Storage. Повторите попытку.');
    sources.push(publicUrl);
  }
  return sources;
}
