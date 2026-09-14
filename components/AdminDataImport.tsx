'use client';

import { useRef, useState } from 'react';
import { useLocale } from './LocaleProvider';
import { useSiteData } from './SiteDataProvider';
import { isLocalMedia, readMedia } from '@/lib/admin-media';
import { readCars, readContacts, type Contacts } from '@/lib/site-data';
import { apiRequest, uploadCloudMedia, type CloudSnapshot } from '@/lib/cloud-client';
import type { Car } from '@/lib/cars';

export function AdminDataImport() {
  const { t } = useLocale();
  const { mode, loaded, cars, error: cloudError, refresh, saveCar, saveContacts } = useSiteData();
  const [preview, setPreview] = useState<{ cars: Car[]; contacts: Contacts } | null>(null);
  const [includeContacts, setIncludeContacts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const running = useRef(false);
  const uploaded = useRef(new Map<string, string>());

  function inspect() {
    try {
      setPreview({ cars: readCars(), contacts: readContacts() }); setError(''); setResult(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось прочитать данные браузера.'); }
  }

  async function migrateSource(source: string) {
    if (!isLocalMedia(source)) return source;
    const existing = uploaded.current.get(source);
    if (existing) return existing;
    const blob = await readMedia(source);
    if (!blob) throw new Error('Один из файлов не найден в этом браузере. Импорт остановлен.');
    const [url] = await uploadCloudMedia([new File([blob], 'vehicle-media', { type: blob.type })]);
    uploaded.current.set(source, url);
    return url;
  }

  async function runImport() {
    if (!preview || mode !== 'supabase' || running.current) return;
    running.current = true; setBusy(true); setError(''); setResult(null);
    let imported = 0, skipped = 0;
    try {
      const snapshot = await apiRequest<CloudSnapshot>('/api/site');
      const existing = new Set(snapshot.cars.map(car => car.id));
      for (const car of preview.cars) {
        if (existing.has(car.id)) { skipped++; continue; }
        setProgress(`${car.brand} ${car.model}`);
        const image = await migrateSource(car.image);
        const gallery: string[] | undefined = car.gallery ? [] : undefined;
        for (const source of car.gallery ?? []) gallery!.push(await migrateSource(source));
        const video = car.video ? await migrateSource(car.video) : undefined;
        await saveCar({ ...car, version: undefined, image, gallery, video });
        imported++;
      }
      if (includeContacts) await saveContacts(preview.contacts, snapshot.contacts);
      setResult({ imported, skipped }); setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Импорт остановлен. Повторите попытку.');
      setResult({ imported, skipped });
    } finally {
      await refresh(); setProgress(''); setBusy(false); running.current = false;
    }
  }

  const existing = new Set(cars.map(car => car.id));
  const count = preview?.cars.filter(car => !existing.has(car.id)).length ?? 0;
  return <section className="admin-panel admin-section-panel">
    <div className="admin-panel-top"><div><h2>{t('Хранение данных')}</h2><p>{t(mode === 'supabase' ? 'Источник данных: Supabase' : 'Источник данных: этот браузер')}</p></div></div>
    <p className="admin-media-help">{t(mode === 'supabase' ? 'Импорт перенесёт автомобили и локальные файлы из этого браузера. Существующие объявления в облаке будут пропущены. Оригиналы останутся в браузере.' : 'Supabase ещё не подключён. Существующие данные сохраняются в этом браузере.')}</p>
    {mode === 'supabase' && <>
      <p className="admin-media-help">{t(loaded && !cloudError ? 'Подключение к базе работает.' : 'База пока недоступна. Проверьте настройки подключения.')}</p>
      <button className="admin-filter-button" type="button" disabled={busy} onClick={() => { void refresh(); }}>{t('Проверить подключение')}</button>{' '}
      <button className="admin-primary" type="button" disabled={busy || !loaded || !!cloudError} onClick={inspect}>{t('Подготовить импорт из браузера')}</button>
    </>}
    {preview && <div className="admin-import-preview">
      <p>{t('К импорту: {count}', { count })}</p>
      <p>{t('Будет пропущено: {count}', { count: preview.cars.length - count })}</p>
      <ul>{preview.cars.filter(car => !existing.has(car.id)).map(car => <li key={car.id}>{car.brand} {car.model} · {car.year}</li>)}</ul>
      <label><input type="checkbox" checked={includeContacts} disabled={busy} onChange={event => setIncludeContacts(event.target.checked)} /> {t('Также заменить контакты сайта данными этого браузера')}</label>
      {includeContacts && <p>{preview.contacts.email} · WhatsApp +{preview.contacts.whatsapp} · Telegram @{preview.contacts.telegram}</p>}
      <button className="admin-primary" type="button" disabled={busy || (!count && !includeContacts)} onClick={() => { void runImport(); }}>{t(busy ? 'Импортируем…' : 'Начать импорт')}</button>
    </div>}
    {progress && <p role="status">{t('Импортируем…')} {progress}</p>}
    {result && <p role="status">{t('Импортировано: {imported}. Пропущено: {skipped}.', result)}</p>}
    {(error || cloudError) && <p className="admin-media-error" role="alert">{t(error || cloudError)}</p>}
  </section>;
}
