'use client';

import { useLocale } from '@/components/LocaleProvider';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { isLocalMedia, readMedia } from '@/lib/admin-media';
import { imageSizes, optimizableImage, type ImageVariant } from '@/lib/image-delivery';

export function useMediaUrl(source?: string) {
  const [resolved, setResolved] = useState<{ source: string; url: string } | null>(null);
  useEffect(() => {
    if (!source || !isLocalMedia(source)) return;
    let cancelled = false;
    let objectUrl: string | undefined;
    void readMedia(source).then(blob => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setResolved({ source, url: objectUrl });
    }).catch(() => {});
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [source]);
  return source && isLocalMedia(source) ? (resolved?.source === source ? resolved.url : undefined) : source || undefined;
}

export function MediaImage({ source, alt, variant, eager = false, sizes, fetchPriority, onReady }: { source?: string; alt: string; variant?: ImageVariant; eager?: boolean; sizes?: string; fetchPriority?: 'auto' | 'low' | 'high'; onReady?: () => void }) {
  const { t } = useLocale();
  const url = useMediaUrl(source);
  const [failed, setFailed] = useState<string>();
  const [original, setOriginal] = useState<string>();
  if (url && failed !== url && variant && original !== url && optimizableImage(url)) {
    return <Image src={url} alt={alt} width={1600} height={1000} sizes={sizes ?? imageSizes[variant]} quality={variant === 'gallery' || variant === 'fullscreen' ? 85 : 70}
      loading={eager ? 'eager' : 'lazy'} fetchPriority={fetchPriority} decoding="async" onLoad={onReady} onError={() => setOriginal(url)} className="optimized-vehicle-image" />;
  }
  return url && failed !== url
    ? <img src={url} alt={alt} loading={eager ? 'eager' : 'lazy'} fetchPriority={fetchPriority} decoding="async" onLoad={onReady} onError={() => { setFailed(url); onReady?.(); }} />
    : <span className="admin-media-placeholder" role="img" aria-label={t(alt || 'Фото отсутствует')}>{t("Нет фото")}</span>;
}
