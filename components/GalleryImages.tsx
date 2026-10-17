'use client';
import { useState } from 'react';
import { MediaImage } from './MediaImage';
import { useLocale } from './LocaleProvider';

function Frame({ source, active, alt, variant, sizes }: { source: string; active: boolean; alt: string; variant: 'gallery' | 'fullscreen'; sizes?: string }) {
  const [ready, setReady] = useState(false); const { t } = useLocale();
  return <div className="gallery-frame" data-active={active} aria-hidden={!active}>
    <MediaImage source={source} alt={active ? alt : ''} variant={variant} sizes={sizes} eager fetchPriority={active ? 'auto' : 'low'} onReady={() => setReady(true)} />
    {active && !ready && <span className="gallery-loading" role="status">{t('Загрузка фото…')}</span>}
  </div>;
}

// Keep adjacent images mounted and decoded, so a swipe can reveal an existing image.
export function GalleryImages({ gallery, current, alt, variant, sizes, preloadNeighbors = true }: {
  gallery: string[]; current: number; alt: string; variant: 'gallery' | 'fullscreen'; sizes?: string; preloadNeighbors?: boolean;
}) {
  const indices = gallery.length ? [...new Set([current, ...(preloadNeighbors && gallery.length > 1 ? [(current + 1) % gallery.length, (current + gallery.length - 1) % gallery.length] : [])])] : [];
  return <div className="gallery-frames">{indices.length ? indices.map(index => <Frame key={`${index}:${gallery[index]}`} source={gallery[index]} active={index === current} alt={alt} variant={variant} sizes={index === current ? sizes : undefined} />) : <MediaImage alt={alt} />}</div>;
}
