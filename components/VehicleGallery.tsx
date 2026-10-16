'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { MediaImage, useMediaUrl } from './MediaImage';
import { useLocale } from './LocaleProvider';

export function VehicleGallery({ gallery, name, videoSource }: { gallery: string[]; name: string; videoSource?: string }) {
  const { t } = useLocale();
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<'photo' | 'video' | null>(null);
  const [zoom, setZoom] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const modal = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const gesture = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const skipClick = useRef(false);
  const videoUrl = useMediaUrl(videoSource);
  const poster = useMediaUrl(gallery[0]);
  const current = Math.min(selected, Math.max(0, gallery.length - 1));
  function select(index: number) { setSelected((index + gallery.length) % gallery.length); setZoom(false); }
  function close() { modal.current?.close(); setMode(null); setZoom(false); }
  function open(next: 'photo' | 'video') { setVideoFailed(false); setMode(next); }
  useEffect(() => {
    if (!mode) return;
    const element = modal.current; element?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; element?.close(); };
  }, [mode]);
  useEffect(() => {
    if (zoom && canvas.current) {
      canvas.current.scrollLeft = (canvas.current.scrollWidth - canvas.current.clientWidth) / 2;
      canvas.current.scrollTop = (canvas.current.scrollHeight - canvas.current.clientHeight) / 2;
    }
  }, [zoom]);
  useEffect(() => {
    const thumb = thumbs.current[current]; const strip = thumb?.parentElement;
    if (thumb && strip) strip.scrollLeft = thumb.offsetLeft - strip.offsetLeft - (strip.clientWidth - thumb.clientWidth) / 2;
  }, [current]);
  function start(event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    gesture.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLElement>) {
    const initial = gesture.current; if (!initial) return;
    if (Math.abs(event.clientX - initial.x) + Math.abs(event.clientY - initial.y) > 12) initial.moved = true;
    if (zoom) { event.currentTarget.scrollLeft = initial.left - (event.clientX - initial.x); event.currentTarget.scrollTop = initial.top - (event.clientY - initial.y); }
  }
  function end(event: PointerEvent<HTMLElement>) {
    const initial = gesture.current; gesture.current = null; if (!initial) return;
    skipClick.current = initial.moved;
    const dx = event.clientX - initial.x; const dy = event.clientY - initial.y;
    if (!zoom && gallery.length > 1 && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) select(current + (dx < 0 ? 1 : -1));
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  const photoName = t('{name}, фото {number}', { name, number: current + 1 });
  return <section className="vehicle-showcase" aria-label={t('Фотографии автомобиля')}>
    <div className="main-gallery-image">
      <button type="button" className="gallery-open" disabled={!gallery.length} aria-label={t('Открыть фотогалерею')} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={() => { gesture.current = null; }} onClick={() => { if (skipClick.current) { skipClick.current = false; return; } open('photo'); }}><MediaImage source={gallery[current]} alt={photoName} variant="gallery" eager /><span className="gallery-expand" aria-hidden="true">⛶</span></button>
      {!!gallery.length && <span className="gallery-counter" aria-live="polite">{current + 1} / {gallery.length}</span>}
      {gallery.length > 1 && <><button type="button" className="gallery-prev" onClick={() => select(current - 1)} aria-label={t('Предыдущее фото')}>←</button><button type="button" className="gallery-next" onClick={() => select(current + 1)} aria-label={t('Следующее фото')}>→</button></>}
    </div>
    <div className="gallery-strip" role="group" aria-label={t('Выбрать фотографию')}>
      {gallery.map((source, index) => <button ref={element => { thumbs.current[index] = element; }} type="button" className={'gallery-thumb ' + (current === index ? 'active' : '')} key={source + index} onClick={() => select(index)} aria-label={t('Фото {number}', { number: index + 1 })} aria-pressed={current === index}><MediaImage source={source} alt="" variant="thumbnail" /></button>)}
      {videoSource && <button type="button" className="gallery-video-thumb" onClick={() => open('video')}><span className="play-icon">▶</span><b>{t('Видео')}</b></button>}
    </div>
    <dialog ref={modal} className="photo-viewer" aria-label={t(mode === 'video' ? 'Видео {name}' : 'Галерея: {name}', { name })} onClose={() => { setMode(null); setZoom(false); }} onClick={event => { if (event.target === event.currentTarget) close(); }} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (mode === 'photo' && gallery.length > 1 && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); select(current + (event.key === 'ArrowRight' ? 1 : -1)); }
    }}>
      <header className="photo-viewer-toolbar"><div><b>{name}</b>{mode === 'photo' && <span aria-live="polite">{current + 1} / {gallery.length}</span>}</div><div>{mode === 'photo' && <button type="button" aria-pressed={zoom} onClick={() => setZoom(!zoom)} aria-label={t(zoom ? 'Уменьшить фото' : 'Увеличить фото')}>{zoom ? '− 1×' : '+ 2×'}</button>}<button type="button" autoFocus onClick={close} aria-label={t('Закрыть галерею')}>×</button></div></header>
      {mode === 'photo' && <><div ref={canvas} className={'photo-viewer-canvas ' + (zoom ? 'zoomed' : '')} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={() => { gesture.current = null; }} onDoubleClick={() => setZoom(!zoom)}><div className="photo-viewer-image"><MediaImage source={gallery[current]} alt={photoName} variant="fullscreen" eager /></div></div>{gallery.length > 1 && <><button type="button" className="photo-viewer-prev" onClick={() => select(current - 1)} aria-label={t('Предыдущее фото')}>←</button><button type="button" className="photo-viewer-next" onClick={() => select(current + 1)} aria-label={t('Следующее фото')}>→</button></>}<p className="photo-viewer-hint">{t(zoom ? 'Перетаскивайте фото для просмотра деталей' : 'Листайте свайпом или стрелками ← →')}</p></>}
      {mode === 'video' && <div className="photo-viewer-video">{videoUrl && <video src={videoUrl} controls autoPlay playsInline poster={poster} onError={() => setVideoFailed(true)} />}{(!videoUrl || videoFailed) && <p role="status">{t('Видео недоступно или его формат не поддерживается браузером.')}</p>}</div>}
    </dialog>
  </section>;
}
