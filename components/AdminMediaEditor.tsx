'use client';

import { useLocale } from '@/components/LocaleProvider';

import { useEffect, useRef, useState } from 'react';
import type { Car } from '@/lib/cars';
import { MediaImage as AdminMediaImage, useMediaUrl } from './MediaImage';
import { removeMedia, storeMedia } from '@/lib/admin-media';
import { useSiteData } from './SiteDataProvider';
import { uploadCloudMedia } from '@/lib/cloud-client';

export { MediaImage as AdminMediaImage } from './MediaImage';

function VideoPreview({ source }: { source: string }) {
  const { locale, t } = useLocale();
  const url = useMediaUrl(source);
  const [failed, setFailed] = useState(false);
  return <>{url && <video src={url} controls playsInline preload="metadata" onError={() => setFailed(true)} />}{(!url || failed) && <p>{t("Видео недоступно или формат не поддерживается браузером. Попробуйте MP4 с кодеком H.264.")}</p>}</>;
}

export const mediaSources = (car: Car) => [...new Set([car.image, ...(car.gallery ?? []), car.video ?? ''].filter(Boolean))];

export function AdminMediaEditor({ car, onChange, onBusy, onUploaded }: {
  car: Car;
  onChange: (media: Pick<Car, 'image' | 'gallery' | 'video'>) => void;
  onBusy: (busy: boolean) => void;
  onUploaded: (sources: string[]) => void;
}) {
  const { locale, t } = useLocale();
  const { mode } = useSiteData();
  const photos = car.gallery ?? (car.image ? [car.image] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const active = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  function updatePhotos(gallery: string[]) {
    onChange({ gallery, image: gallery[0] ?? '', video: car.video });
  }

  async function upload(files: File[], kind: 'photo' | 'video') {
    if (!files.length || active.current) return;
    setError('');
    const allowed = kind === 'photo' ? ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] : ['video/mp4', 'video/webm', 'video/quicktime'];
    const limit = (kind === 'photo' ? 15 : mode !== 'local' ? 50 : 200) * 1024 * 1024;
    if (kind === 'video' && files.length !== 1) { setError('Выберите одно видео.'); return; }
    const invalid = files.find((file) => !allowed.includes(file.type) || !file.size || file.size > limit);
    if (invalid) { setError(`«${invalid.name}»: ${t(kind === 'photo' ? 'нужно фото JPG, PNG, WebP или AVIF до 15 МБ' : mode !== 'local' ? 'нужно видео MP4, WebM или MOV до 50 МБ' : 'нужно видео MP4, WebM или MOV до 200 МБ')}.`); return; }
    active.current = true;
    setBusy(true);
    onBusy(true);
    try {
      const sources = await (mode !== 'local' ? uploadCloudMedia(files) : storeMedia(files));
      if (!mounted.current) { await removeMedia(sources); return; }
      onUploaded(sources);
      if (kind === 'photo') updatePhotos([...photos, ...sources]);
      else onChange({ image: car.image, gallery: car.gallery, video: sources[0] });
    } catch (err) {
      if (mounted.current) setError(mode !== 'local' && err instanceof Error ? err.message : 'Не удалось сохранить файлы. Возможно, в хранилище браузера недостаточно места. Попробуйте файл меньшего размера.');
    } finally {
      active.current = false;
      if (mounted.current) { setBusy(false); onBusy(false); }
    }
  }

  function addUrl() {
    try {
      const parsed = new URL(url.trim());
      if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error();
      if (photos.includes(parsed.href)) { setError('Это фото уже добавлено.'); return; }
      updatePhotos([...photos, parsed.href]);
      setUrl(''); setError('');
    } catch { setError('Укажите полную ссылку на изображение, начинающуюся с https:// или http://.'); }
  }

  function move(index: number, step: number) {
    const reordered = [...photos];
    [reordered[index], reordered[index + step]] = [reordered[index + step], reordered[index]];
    updatePhotos(reordered);
  }

  return <fieldset className="admin-media" disabled={busy}>
    <legend>{t("Фотографии и видео")}</legend>
    <p className="admin-media-help">{t("Можно добавить больше 12 фото и одно видео. Первое фото — обложка объявления.")}</p>
    <label className="admin-media-upload"><strong>{t("＋ Добавить фотографии")}</strong><span>{t("JPG, PNG, WebP, AVIF · до 15 МБ каждое")}</span><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void upload(files, 'photo'); }} /></label>
    <p className="admin-media-count">{t("Фотографии:")} {photos.length}</p>
    <div className="admin-media-grid">{photos.map((source, index) => <article className="admin-media-photo" key={`${source}-${index}`}>
      <AdminMediaImage source={source} alt={t('Фото автомобиля {number}', { number: index + 1 })} />
      <span className="admin-media-number">{index === 0 ? t('Обложка') : index + 1}</span>
      <div className="admin-media-actions"><button type="button" disabled={index === 0} onClick={() => updatePhotos([source, ...photos.filter((_, i) => i !== index)])} aria-label={t('Сделать фото {number} обложкой', { number: index + 1 })} title={t("Сделать обложкой")}>★</button><button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t('Переместить фото {number} влево', { number: index + 1 })}>←</button><button type="button" disabled={index === photos.length - 1} onClick={() => move(index, 1)} aria-label={t('Переместить фото {number} вправо', { number: index + 1 })}>→</button><button type="button" onClick={() => updatePhotos(photos.filter((_, i) => i !== index))} aria-label={t('Удалить фото {number}', { number: index + 1 })}>×</button></div>
    </article>)}</div>
    <details className="admin-media-link"><summary>{t("Добавить фото по ссылке")}</summary><div><input type="text" inputMode="url" aria-label={t("Ссылка на фотографию")} placeholder="https://…" value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addUrl(); } }} /><button type="button" onClick={addUrl}>{t("Добавить")}</button></div></details>
    <div className="admin-media-video"><h3>{t("Видеообзор")}</h3>{car.video && <><VideoPreview key={car.video} source={car.video} /><button className="admin-media-remove" type="button" onClick={() => onChange({ image: car.image, gallery: car.gallery, video: undefined })}>{t("Удалить видео")}</button></>}
      <label className="admin-media-upload"><strong>{t(car.video ? 'Заменить видео' : '＋ Добавить видео')}</strong><span>{t(mode !== 'local' ? 'MP4, WebM, MOV · до 50 МБ · для совместимости рекомендуем MP4 (H.264)' : 'MP4, WebM, MOV · до 200 МБ · для совместимости рекомендуем MP4 (H.264)')}</span><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void upload(files, 'video'); }} /></label>
    </div>
    {busy && <p role="status">{t("Сохраняем файлы…")}</p>}
    {error && <p className="admin-media-error" role="alert">{t(error)}</p>}
  </fieldset>;
}
