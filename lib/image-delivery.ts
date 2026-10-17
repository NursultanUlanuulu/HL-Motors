// Only these public image hosts are passed through the server optimizer.
export function optimizableImage(source: string, mediaOrigin = process.env.NEXT_PUBLIC_MEDIA_ORIGIN ?? '', r2Origin = process.env.NEXT_PUBLIC_R2_ORIGIN ?? ''): boolean {
  if (source.startsWith('/') && !source.startsWith('//') && !source.startsWith('/api/')) return !source.toLowerCase().endsWith('.svg');
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return false;
    if (url.hostname === 'img.autohaina.com') return url.pathname.startsWith('/vehicle/') && !url.search;
    if (url.hostname === 'images.unsplash.com') return url.pathname.startsWith('/photo-');
    if (r2Origin && url.origin === r2Origin) return url.pathname.startsWith('/vehicles/') && !url.search;
    return !!mediaOrigin && url.origin === mediaOrigin && url.pathname.startsWith('/storage/v1/object/public/vehicle-media/') && !url.search;
  } catch { return false; }
}
export type ImageVariant = 'card' | 'gallery' | 'thumbnail' | 'fullscreen';
export const imageSizes: Record<ImageVariant, string> = {
  card: '(max-width: 650px) calc(100vw - 32px), (max-width: 900px) calc((100vw - 68px) / 2), (max-width: 1200px) calc((100vw - 300px) / 2), (max-width: 1600px) calc((100vw - 402px) / 3), 400px',
  gallery: '(max-width: 650px) calc(100vw - 32px), (max-width: 900px) calc(100vw - 346px), (max-width: 1360px) calc(100vw - 438px), 880px',
  thumbnail: '90px', fullscreen: '100vw',
};
