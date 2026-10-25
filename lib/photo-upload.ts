import { isHeicPhoto, pngUploadLimit } from './photo-types';

export async function preparePhoto(file: File): Promise<File> {
  if (!isHeicPhoto(file)) return file;
  const blob = await new Promise<Blob>((resolve, reject) => {
    const worker = new Worker(new URL('./heic.worker.ts', import.meta.url));
    const finish = (error?: string, result?: Blob) => {
      clearTimeout(timer);
      worker.terminate();
      if (error || !result) reject(new Error(error ?? 'Не удалось преобразовать HEIC. Попробуйте другое фото или экспортируйте его в PNG.'));
      else resolve(result);
    };
    const timer = setTimeout(() => finish('Конвертация HEIC заняла слишком много времени. Попробуйте загрузить фото отдельно.'), 120_000);
    worker.onerror = () => finish();
    worker.onmessageerror = () => finish();
    worker.onmessage = (event: MessageEvent<{ blob?: Blob; error?: string }>) => finish(event.data.error, event.data.blob);
    worker.postMessage(file);
  });
  if (blob.type !== 'image/png' || !blob.size) throw new Error('Не удалось преобразовать HEIC. Попробуйте другое фото или экспортируйте его в PNG.');
  if (blob.size > pngUploadLimit) throw new Error('После конвертации PNG превышает 100 МБ. Выберите другое фото.');
  return new File([blob], file.name.replace(/\.(heic|heif)$/i, '') + '.png', { type: 'image/png', lastModified: file.lastModified });
}
