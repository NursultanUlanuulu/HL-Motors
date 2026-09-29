import type { Car } from './cars';
import { isCar, publicCar } from './site-data';

export type DataMode = 'local' | 'supabase';
export const mediaBucket = 'vehicle-media';
export const photoLimit = 15 * 1024 * 1024;
export const cloudVideoLimit = 50 * 1024 * 1024;
export const mediaTypes: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
};

export class DataError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function validateCloudCar(value: unknown): Car {
  if (!isCar(value) || !/^[\w-]{1,100}$/.test(value.id) || !value.brand.trim() || !value.model.trim()) {
    throw new DataError('Проверьте данные автомобиля.');
  }
  if (JSON.stringify(value).length > 128000 || (value.gallery?.length ?? 0) > 100) throw new DataError('Объявление слишком большое.');
  const sources = [value.image, ...(value.gallery ?? []), value.video ?? ''].filter(Boolean);
  for (const source of sources) {
    // Keep the API and JSONB constraint aligned: URL() alone also accepts
    // shorthand such as "https:photo" and strips surrounding whitespace.
    if (!/^https?:\/\/[^\s]+$/i.test(source)) throw new DataError('Сначала загрузите фотографии и видео в облако.');
    let url: URL;
    try { url = new URL(source); } catch { throw new DataError('Сначала загрузите фотографии и видео в облако.'); }
    if (!['https:', 'http:'].includes(url.protocol)) throw new DataError('Сначала загрузите фотографии и видео в облако.');
  }
  const { version: _version, ...car } = publicCar(value)!;
  return car;
}

export function requireVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new DataError('Обновите страницу перед редактированием.');
  return Number(value);
}

export function validateUpload(type: unknown, size: unknown) {
  if (typeof type !== 'string' || !Object.hasOwn(mediaTypes, type) || typeof size !== 'number' || !Number.isSafeInteger(size) || size <= 0) {
    throw new DataError('Неподдерживаемый файл.');
  }
  const limit = type.startsWith('image/') ? photoLimit : cloudVideoLimit;
  if (size > limit) throw new DataError('Фото — до 15 МБ, видео — до 50 МБ.');
  return mediaTypes[type];
}
