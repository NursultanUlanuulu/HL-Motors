export const photoInputLimit = 15 * 1024 * 1024;
export const pngUploadLimit = 100 * 1024 * 1024;
export const photoAccept = 'image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/heic-sequence,image/heif-sequence,.heic,.heif';
const supported = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export function isHeicPhoto(file: Pick<File, 'name' | 'type'>) {
  return /\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf](?:-sequence)?$/i.test(file.type);
}

export function acceptsPhoto(file: Pick<File, 'name' | 'type' | 'size'>) {
  return file.size > 0 && file.size <= photoInputLimit && (supported.includes(file.type) || isHeicPhoto(file));
}

