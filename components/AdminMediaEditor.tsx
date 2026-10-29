'use client';

import { useLocale } from '@/components/LocaleProvider';

import { useEffect, useRef, useState } from 'react';
import type { Car } from '@/lib/cars';
import { MediaImage as AdminMediaImage, useMediaUrl } from './MediaImage';
import { removeMedia, storeMedia } from '@/lib/admin-media';
import { useSiteData } from './SiteDataProvider';
import { apiRequest, uploadCloudMedia } from '@/lib/cloud-client';
import { uploadVideo, type VideoJob } from '@/lib/video-client';
import { acceptsPhoto, isHeicPhoto, photoAccept } from '@/lib/photo-types';
import { preparePhoto } from '@/lib/photo-upload';

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
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [videoJob, setVideoJob] = useState<VideoJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<VideoJob[] | null>(null);
  const [recentBusy, setRecentBusy] = useState(false);
  const active = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!videoJob || !['queued', 'processing'].includes(videoJob.status)) return;
    let cancelled = false;
    let polling = false;
    const timer = setInterval(() => {
      if (polling) return;
      polling = true;
      void apiRequest<VideoJob>('/api/admin/video', { action: 'status', id: videoJob.id }).then(job => {
        if (!cancelled) { setVideoJob(job); setError(''); }
      }).catch(() => { if (!cancelled) setError(t('Не удалось проверить обработку. Проверка повторится автоматически.')); }).finally(() => { polling = false; });
    }, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [videoJob?.id, videoJob?.status, t]);

  async function showRecent() {
    setRecentBusy(true); setError('');
    try { const result = await apiRequest<{ jobs: VideoJob[] }>('/api/admin/video', { action: 'recent' }); setRecentJobs(result.jobs); }
    catch (err) { setError(err instanceof Error ? err.message : 'Не удалось выполнить запрос.'); }
    finally { setRecentBusy(false); }
  }
  function useVideo(job: VideoJob) {
    if (job.status !== 'ready' || !job.publicUrl) return;
    onChange({ image: car.image, gallery: car.gallery, video: job.publicUrl });
    onUploaded([job.publicUrl]); setVideoJob(null); setRecentJobs(null);
  }

  function updatePhotos(gallery: string[]) {
    onChange({ gallery, image: gallery[0] ?? '', video: car.video });
  }

  async function upload(files: File[], kind: 'photo' | 'video') {
    if (!files.length || active.current) return;
    setError('');
    const allowed = kind === 'photo' ? ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] : ['video/mp4', 'video/webm', 'video/quicktime'];
    const limit = (kind === 'photo' ? 15 : mode !== 'local' ? 500 : 200) * 1024 * 1024;
    if (kind === 'video' && files.length !== 1) { setError('Выберите одно видео.'); return; }
    const invalid = files.find((file) => kind === 'photo' ? !acceptsPhoto(file) : !allowed.includes(file.type) || !file.size || file.size > limit);
    if (invalid) { setError(`«${invalid.name}»: ${t(kind === 'photo' ? 'нужно фото JPG, PNG, WebP, AVIF, HEIC или HEIF до 15 МБ' : mode !== 'local' ? 'нужно видео MP4, WebM или MOV до 500 МБ' : 'нужно видео MP4, WebM или MOV до 200 МБ')}.`); return; }
    active.current = true;
    setBusy(true);
    onBusy(true);
    const sources: string[] = [];
    try {
      if (kind === 'video' && mode !== 'local') {
        const job = await uploadVideo(files[0], percent => { if (mounted.current) setProgress(t('Загрузка видео: {percent}%', { percent })); });
        if (mounted.current) setVideoJob(job);
        return;
      }
      for (const [index, file] of files.entries()) {
        if (!mounted.current) break;
        setProgress(t(kind === 'photo' && isHeicPhoto(file) ? 'Конвертируем HEIC в PNG: {number} из {total}…' : 'Загружаем файл: {number} из {total}…', { number: index + 1, total: files.length }));
        const prepared = kind === 'photo' ? await preparePhoto(file) : file;
        if (!mounted.current) break;
        setProgress(t('Загружаем файл: {number} из {total}…', { number: index + 1, total: files.length }));
        const uploaded = await (mode !== 'local' ? uploadCloudMedia([prepared]) : storeMedia([prepared]));
        if (!mounted.current) { await removeMedia(uploaded); break; }
        sources.push(...uploaded);
        onUploaded(uploaded);
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Не удалось сохранить файлы. Возможно, в хранилище браузера недостаточно места. Попробуйте файл меньшего размера.');
    } finally {
      active.current = false;
      if (mounted.current) {
        if (sources.length) {
          if (kind === 'photo') updatePhotos([...photos, ...sources]);
          else onChange({ image: car.image, gallery: car.gallery, video: sources[0] });
        }
        setBusy(false); setProgress(''); onBusy(false);
      }
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
    <label className="admin-media-upload"><strong>{t("＋ Добавить фотографии")}</strong><span>{t("JPG, PNG, WebP, AVIF, HEIC/HEIF · до 15 МБ каждое")}</span><input type="file" multiple accept={photoAccept} onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void upload(files, 'photo'); }} /></label>
    <p className="admin-media-help">{t('HEIC автоматически преобразуется в PNG без уменьшения разрешения. Для Live Photo сохраняется один кадр.')}</p>
    <p className="admin-media-count">{t("Фотографии:")} {photos.length}</p>
    <div className="admin-media-grid">{photos.map((source, index) => <article className="admin-media-photo" key={`${source}-${index}`}>
      <AdminMediaImage source={source} alt={t('Фото автомобиля {number}', { number: index + 1 })} />
      <span className="admin-media-number">{index === 0 ? t('Обложка') : index + 1}</span>
      <div className="admin-media-actions"><button type="button" disabled={index === 0} onClick={() => updatePhotos([source, ...photos.filter((_, i) => i !== index)])} aria-label={t('Сделать фото {number} обложкой', { number: index + 1 })} title={t("Сделать обложкой")}>★</button><button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t('Переместить фото {number} влево', { number: index + 1 })}>←</button><button type="button" disabled={index === photos.length - 1} onClick={() => move(index, 1)} aria-label={t('Переместить фото {number} вправо', { number: index + 1 })}>→</button><button type="button" onClick={() => updatePhotos(photos.filter((_, i) => i !== index))} aria-label={t('Удалить фото {number}', { number: index + 1 })}>×</button></div>
    </article>)}</div>
    <details className="admin-media-link"><summary>{t("Добавить фото по ссылке")}</summary><div><input type="text" inputMode="url" aria-label={t("Ссылка на фотографию")} placeholder="https://…" value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addUrl(); } }} /><button type="button" onClick={addUrl}>{t("Добавить")}</button></div></details>
    <div className="admin-media-video"><h3>{t("Видеообзор")}</h3>{car.video && <><VideoPreview key={car.video} source={car.video} /><button className="admin-media-remove" type="button" onClick={() => onChange({ image: car.image, gallery: car.gallery, video: undefined })}>{t("Удалить видео")}</button></>}
      <label className="admin-media-upload"><strong>{t(car.video ? 'Заменить видео' : '＋ Добавить видео')}</strong><span>{t(mode !== 'local' ? 'MP4, WebM, MOV · до 500 МБ и 30 минут · автоматическая подготовка до 1080p' : 'MP4, WebM, MOV · до 200 МБ · для совместимости рекомендуем MP4 (H.264)')}</span><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void upload(files, 'video'); }} /></label>
      {videoJob && <div role="status"><p>{videoJob.filename} — {t(videoJob.status === 'ready' ? 'Видео готово' : videoJob.status === 'failed' ? 'Ошибка обработки видео' : videoJob.status === 'queued' ? 'Видео в очереди' : 'Обрабатываем видео: {percent}%', { percent: videoJob.progress })}</p>
        {videoJob.error && <p className="admin-media-error">{t(videoJob.error)}</p>}
        {videoJob.status === 'ready' && <button type="button" className="admin-cancel" onClick={() => useVideo(videoJob)}>{t('Использовать видео')}</button>}
      </div>}
      {mode !== 'local' && <>
        <p className="admin-media-help">{t('Обработка продолжается на сервере. Можно заполнить остальные поля. Когда видео готово, нажмите «Использовать видео» и сохраните объявление. После обновления страницы найдите ролик в недавних загрузках.')}</p>
        <button type="button" className="admin-cancel" disabled={recentBusy} onClick={() => void showRecent()}>{t(recentBusy ? 'Загрузка…' : 'Недавние загрузки видео')}</button>
        {recentJobs && <div className="admin-video-jobs">{recentJobs.length === 0 && <p>{t('Загрузок видео пока нет.')}</p>}{recentJobs.map(job => <div key={job.id}><p>{job.filename} — {t(job.status === 'ready' ? 'Видео готово' : job.status === 'failed' ? 'Ошибка обработки видео' : job.status === 'uploading' ? 'Загрузка не завершена' : 'Обработка видео')}</p>{job.status === 'ready' ? <button type="button" className="admin-cancel" onClick={() => useVideo(job)}>{t('Использовать видео')}</button> : ['queued', 'processing'].includes(job.status) ? <button type="button" className="admin-cancel" onClick={() => { setVideoJob(job); setRecentJobs(null); }}>{t('Показать обработку')}</button> : job.status === 'uploading' ? <button type="button" className="admin-cancel" onClick={() => { void apiRequest<VideoJob>('/api/admin/video', { action: 'start', id: job.id }).then(result => { setVideoJob(result); setRecentJobs(null); }).catch(err => setError(err.message)); }}>{t('Проверить загруженный файл')}</button> : <p>{t(job.error || '')}</p>}</div>)}</div>}
      </>}
    </div>
    {busy && <p role="status">{progress || t("Сохраняем файлы…")}</p>}
    {error && <p className="admin-media-error" role="alert">{t(error)}</p>}
  </fieldset>;
}
