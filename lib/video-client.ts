import { apiRequest } from './cloud-client';

export type VideoJob = { id: string; filename: string; status: 'uploading' | 'queued' | 'processing' | 'ready' | 'failed'; progress: number; publicUrl?: string; error?: string };
export async function uploadVideo(file: File, onProgress: (percent: number) => void): Promise<VideoJob> {
  const ticket = await apiRequest<{ id: string; uploadUrl: string; headers: Record<string, string> }>('/api/admin/video', { action: 'create', type: file.type, size: file.size, filename: file.name });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', ticket.uploadUrl);
    xhr.timeout = 60 * 60 * 1000;
    for (const [key, value] of Object.entries(ticket.headers)) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Не удалось загрузить видео. Повторите попытку.'));
    xhr.onerror = xhr.ontimeout = xhr.onabort = () => reject(new Error('Не удалось загрузить видео. Проверьте подключение и повторите попытку.'));
    xhr.send(file);
  });
  return apiRequest<VideoJob>('/api/admin/video', { action: 'start', id: ticket.id });
}
