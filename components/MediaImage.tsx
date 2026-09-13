'use client';

import { useLocale } from '@/components/LocaleProvider';

import { useEffect, useState } from 'react';
import { isLocalMedia, readMedia } from '@/lib/admin-media';

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

export function MediaImage({ source, alt }: { source?: string; alt: string }) {
  const { t } = useLocale();
  const url = useMediaUrl(source);
  const [failed, setFailed] = useState<string>();
  return url && failed !== url
    ? <img src={url} alt={alt} loading="lazy" onError={() => setFailed(url)} />
    : <span className="admin-media-placeholder" role="img" aria-label={t(alt || 'Фото отсутствует')}>{t("Нет фото")}</span>;
}
