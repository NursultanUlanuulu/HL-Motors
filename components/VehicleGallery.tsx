'use client';

import { useLocale } from '@/components/LocaleProvider';

import { useEffect, useRef, useState } from 'react';
import { MediaImage, useMediaUrl } from './MediaImage';

export function VehicleGallery({ gallery, name, videoSource }: { gallery: string[]; name: string; videoSource?: string }) {
  const { t } = useLocale();
  const [selected, setSelected] = useState(0);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const videoUrl = useMediaUrl(videoSource);
  const poster = useMediaUrl(gallery[0]);

  useEffect(() => {
    if (!videoOpen) return;
    closeButton.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setVideoOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', onKeyDown); videoButton.current?.focus(); };
  }, [videoOpen]);

  return <section className="vehicle-showcase">
    <div className="main-gallery-image">
      <MediaImage source={gallery[selected]} alt={t('{name}, фото {number}', { name, number: selected + 1 })} />
      {gallery.length > 0 && <span className="gallery-counter">{selected + 1} / {gallery.length}</span>}
      {gallery.length > 1 && <button className="gallery-next" onClick={() => setSelected((selected + 1) % gallery.length)} aria-label={t("Следующее фото")}>→</button>}
    </div>
    <div className="gallery-strip">
      {gallery.map((source, index) => <button className={`gallery-thumb ${selected === index ? 'active' : ''}`} key={`${source}-${index}`} onClick={() => setSelected(index)} aria-label={t('Фото {number}', { number: index + 1 })}><MediaImage source={source} alt="" /></button>)}
      {videoSource && <button ref={videoButton} className="gallery-video-thumb" onClick={() => setVideoOpen(true)}><span className="play-icon">▶</span><b>{t("Видео")}<br />{t("обзор")}</b></button>}
    </div>
    {videoOpen && <aside className="video-modal open" role="dialog" aria-modal="true" aria-label={t('Видео {name}', { name })}>
      <button className="modal-backdrop" onClick={() => setVideoOpen(false)} aria-label={t("Закрыть видео")} />
      <div className="video-shell"><button ref={closeButton} className="modal-close" onClick={() => setVideoOpen(false)} aria-label={t("Закрыть")}>×</button>
        {videoUrl && <video src={videoUrl} controls autoPlay playsInline poster={poster} onError={() => setVideoFailed(true)} />}
        {(!videoUrl || videoFailed) && <p className="media-video-error" role="status">{t("Видео недоступно или его формат не поддерживается браузером.")}</p>}
      </div>
    </aside>}
  </section>;
}
