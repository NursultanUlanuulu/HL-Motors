'use client';

import { useLocale } from '@/components/LocaleProvider';

import { type FormEvent, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Car, CarCondition, CarStatus, CustomsType } from '@/lib/cars';
import { carPriceMin, carPriceMax, customsTypes, formatPrice } from '@/lib/cars';
import { AdminMediaEditor, AdminMediaImage, mediaSources } from './AdminMediaEditor';
import { removeMedia } from '@/lib/admin-media';
import { useSiteData } from './SiteDataProvider';
import { catalogOptions } from '@/lib/site-data';
import { filterAdminCars, initialAdminFilters, type AdminFilters } from '@/lib/catalog-filters';
import { CarTextEditor } from './CarTextEditor';
import { CarSpecsEditor } from './CarSpecsEditor';
import { normalizeCarText, localizeCar, brandLabel } from '@/lib/car-translations';
import { ensureAdminSession } from '@/app/actions/auth';
import { withDeadline, clientRequestTimeoutMs } from '@/lib/request-deadline';
import { SearchSelect } from './SearchSelect';
import { applyCarTemplate } from '@/lib/car-template';

const statuses: CarStatus[] = ['В наличии', 'В пути', 'Под заказ'];
const conditions: CarCondition[] = ['Новый', 'С пробегом'];
const emptyCar = (): Car => ({ id: `HL-${crypto.randomUUID()}`, brand: '', model: '', trim: '', price: 0, year: new Date().getFullYear(), mileage: '', status: 'Под заказ', condition: 'Новый', city: 'Китай', power: '', drive: '', image: '', gallery: [] });

export function AdminDashboard() {
  const { locale, t } = useLocale();
  const { cars: items, loaded, error, mode, saveCar: storeCar, removeCar } = useSiteData();
  const [filters, setFilters] = useState(initialAdminFilters);
  const [draft, setDraft] = useState<Car | null>(null);
  const [deleting, setDeleting] = useState<Car | null>(null);
  const [toast, setToast] = useState('');
  const [editorError, setEditorError] = useState('');
  const [mediaBusy, setMediaBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [templateApplied, setTemplateApplied] = useState(false);
  const pendingMedia = useRef<string[]>([]);
  const original = useRef<Car | undefined>(undefined);
  const visible = useMemo(() => filterAdminCars(items, filters), [items, filters]);
  const templateOptions = useMemo(() => items.map(car => {
    const display = localizeCar(car, locale);
    return { value: car.id, label: `${display.brand} ${display.model} · ${car.year}`, detail: [display.trim, car.carCode || car.id].filter(Boolean).join(' · '), keywords: [car.brand, car.model, car.id, ...Object.values(car.translations ?? {}).flatMap(text => [text.brand, text.model, text.trim])].filter(Boolean).join(' ') };
  }), [items, locale]);
  const { brands, years } = catalogOptions(items);
  const busy = mediaBusy || saving;
  const draftDisplay = draft ? localizeCar(draft, locale) : null;
  const updateFilter = (key: keyof AdminFilters, value: string) => setFilters(current => ({ ...current, [key]: value }));
  const updateDraft = <K extends keyof Car>(key: K, value: Car[K]) => setDraft(current => current ? { ...current, [key]: value } : current);

  function openEditor(car?: Car) {
    original.current = car;
    pendingMedia.current = [];
    setEditorError('');
    setTemplateId('');
    setTemplateApplied(false);
    setDraft(car ? { ...car, gallery: car.gallery ? [...car.gallery] : undefined } : emptyCar());
  }
  function applyTemplate() {
    const source = items.find(car => car.id === templateId);
    if (!source || !draft || original.current || busy) return;
    setDraft(applyCarTemplate(draft, source));
    setTemplateApplied(true);
  }
  function closeEditor() {
    if (busy) return;
    void removeMedia(pendingMedia.current).catch(() => {});
    pendingMedia.current = [];
    setDraft(null);
  }
  function cleanup(next: Car[], previous: Car[]) {
    const retained = new Set(next.flatMap(mediaSources));
    const obsolete = [...new Set([...previous.flatMap(mediaSources), ...pendingMedia.current])].filter(source => !retained.has(source));
    void removeMedia(obsolete).catch(() => {});
    pendingMedia.current = [];
  }
  async function saveCar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !loaded || !draft) return;
    setSaving(true); setEditorError('');
    try {
      if (mode === 'local' && !await withDeadline(() => ensureAdminSession(), { timeoutMs: clientRequestTimeoutMs })) throw new Error('Сессия завершена. Войдите в админку снова.');
      const gallery = (draft.gallery ?? [draft.image]).map(source => source.trim()).filter(Boolean);
      const normalized = normalizeCarText({ ...draft, gallery, image: gallery[0] || '' });
      const next = await storeCar(normalized, original.current);
      cleanup(next, original.current ? [original.current] : []);
      setDraft(null);
      setToast(original.current ? 'Изменения сохранены и опубликованы на сайте.' : 'Автомобиль добавлен на сайт.');
    } catch (err) { setEditorError(err instanceof Error ? err.message : 'Не удалось сохранить автомобиль. Проверьте хранилище браузера.'); }
    finally { setSaving(false); }
  }
  async function archiveCar() {
    if (!deleting || saving) return;
    setSaving(true);
    try {
      if (mode === 'local' && !await withDeadline(() => ensureAdminSession(), { timeoutMs: clientRequestTimeoutMs })) throw new Error('Сессия завершена. Войдите в админку снова.');
      const next = await removeCar(deleting);
      cleanup(next, [deleting]);
      setDeleting(null); setToast('Объявление удалено из каталога и с сайта.');
    } catch (err) { setToast(err instanceof Error ? err.message : 'Не удалось удалить объявление.'); }
    finally { setSaving(false); }
  }

  return <>
    {error && <p className="admin-media-error" role="alert">{t(error)}</p>}
    <section className="admin-panel">
      <div className="admin-panel-top"><div><h2>{t("Список автомобилей")}</h2><p>{t("Управляйте объявлениями, ценами и текущими статусами.")}</p></div><button className="admin-primary" type="button" disabled={!loaded} onClick={() => openEditor()}><span>＋</span>  {t("Добавить автомобиль")}</button></div>
      <div className="admin-controls">
        <label className="admin-search"><span>⌕</span><input aria-label={t("Поиск автомобилей")} value={filters.query} onChange={event => updateFilter('query', event.target.value)} placeholder={t("Марка, модель, номер или VIN")} /></label>
        <div className="admin-status-tabs">{['', ...statuses].map(status => <button key={status} className={filters.status === status ? 'active' : ''} onClick={() => updateFilter('status', status)}>{t(status || 'Все')}</button>)}</div>
        <span className="admin-result-count">{loaded ? t('{shown} из {total}', { shown: visible.length, total: items.length }) : t('Загрузка…')}</span>
      </div>
      <div className="admin-catalog-filters">
        <label>{t("Марка")}<select value={filters.brand} onChange={event => updateFilter('brand', event.target.value)}><option value="">{t("Все марки")}</option>{brands.map(brand => <option key={brand} value={brand}>{brandLabel(brand, items, locale)}</option>)}</select></label>
        <label>{t("Год")}<select value={filters.year} onChange={event => updateFilter('year', event.target.value)}><option value="">{t("Любой год")}</option>{years.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
        <label>{t("Цена от, USD")}<input type="number" min="0" value={filters.minPrice} onChange={event => updateFilter('minPrice', event.target.value)} placeholder={t("Без ограничения")} /></label>
        <label>{t("Цена до, USD")}<input type="number" min="0" value={filters.maxPrice} onChange={event => updateFilter('maxPrice', event.target.value)} placeholder={t("Без ограничения")} /></label>
        <label>{t("Состояние")}<select value={filters.condition} onChange={event => updateFilter('condition', event.target.value)}><option value="">{t("Любое состояние")}</option>{conditions.map(condition => <option key={condition} value={condition}>{t(condition)}</option>)}</select></label>
        <label>{t("Сортировка")}<select value={filters.sort} onChange={event => updateFilter('sort', event.target.value)}><option value="default">{t("Порядок каталога")}</option><option value="price-asc">{t("Сначала дешевле")}</option><option value="price-desc">{t("Сначала дороже")}</option><option value="year-desc">{t("Сначала новее")}</option><option value="year-asc">{t("Сначала старше")}</option><option value="brand">{t("По марке и модели")}</option></select></label>
        <button className="admin-cancel" type="button" onClick={() => setFilters(initialAdminFilters)}>{t("Сбросить фильтры")}</button>
      </div>
      {filters.minPrice && filters.maxPrice && Number(filters.minPrice) > Number(filters.maxPrice) && <p className="admin-media-error">{t("Цена «от» не должна быть больше цены «до».")}</p>}
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{t("Автомобиль")}</th><th>{t("Цена")}</th><th>{t("Статус")}</th><th>{t("Год / пробег")}</th><th>{t("Местонахождение")}</th><th>{t("Действия")}</th></tr></thead><tbody>
        {loaded && visible.map(car => { const displayCar = localizeCar(car, locale); return <tr key={car.id}>
          <td><div className="admin-car"><AdminMediaImage source={car.image} alt="" /><div><b>{displayCar.brand} {displayCar.model}</b><span>{t(displayCar.trim || 'Комплектация не указана')} · {car.id}</span></div></div></td>
          <td><b>${formatPrice(car.price)}</b><span className="admin-cell-note">USD</span></td>
          <td><span className={`admin-status ${car.status === 'В наличии' ? 'available' : car.status === 'В пути' ? 'transit' : 'order'}`}><i />{t(car.status)}</span></td>
          <td>{car.year}<span className="admin-cell-note">{displayCar.mileage}</span></td><td>{displayCar.city}</td>
          <td><div className="admin-row-actions"><Link className="admin-preview-link" href={`/catalog/${car.id}`} target="_blank">{t("На сайте ↗")}</Link><button className="admin-edit-button" type="button" onClick={() => openEditor(car)} aria-label={t('Редактировать {name}', { name: `${displayCar.brand} ${displayCar.model}` })}>{t("✎ Редактировать")}</button><button type="button" onClick={() => setDeleting(car)} aria-label={t('Удалить {name}', { name: `${displayCar.brand} ${displayCar.model}` })}>×</button></div></td>
        </tr>; })}
      </tbody></table>{loaded && visible.length === 0 && <div className="admin-empty">{t("Ничего не найдено. Измените запрос или сбросьте фильтры.")}</div>}</div>
    </section>
    {draft && <div className="admin-editor-layer" role="dialog" aria-modal="true" aria-label={t("Редактор автомобиля")}>
      <button className="admin-editor-backdrop" onClick={closeEditor} aria-label={t("Закрыть редактор")} />
      <form className="admin-editor" onSubmit={saveCar}>
        <header><div><p>{t(original.current ? 'Редактирование объявления' : 'Новое объявление')}</p><h2>{draftDisplay?.brand && draftDisplay?.model ? `${draftDisplay.brand} ${draftDisplay.model}` : t('Автомобиль')}</h2></div><button type="button" className="admin-editor-close" disabled={busy} onClick={closeEditor} aria-label={t("Закрыть")}>×</button></header>
        <div className="admin-editor-body"><fieldset className="admin-editor-fields" disabled={saving}>
          {!original.current && <fieldset><legend>{t('Создать на основе')}</legend>
            <p className="admin-media-help">{t('Выберите автомобиль из каталога, чтобы заполнить характеристики и описания на всех языках.')}</p>
            <div className="admin-form-grid">
              <SearchSelect label={t('Автомобиль из каталога')} value={templateId} options={templateOptions} placeholder={t('Выберите автомобиль')} disabled={busy || !items.length} onChange={value => { setTemplateId(value); setTemplateApplied(false); }} />
              <button type="button" className="admin-cancel" disabled={busy || !items.some(car => car.id === templateId)} onClick={applyTemplate}>{t('Заполнить характеристики')}</button>
            </div>
            <p className="admin-media-help">{t('Заменятся только характеристики модели и описания. Год, цвет, пробег, цены, VIN, фотографии и другие данные новой машины заполняются отдельно. Проверьте скопированные описания.')}</p>
            {!items.length && <p className="admin-media-help">{t('В каталоге пока нет автомобилей для копирования.')}</p>}
            {templateApplied && <p role="status" className="admin-media-help">{t('Данные скопированы. Проверьте форму и сохраните новое объявление.')}</p>}
          </fieldset>}
          <AdminMediaEditor key={`media-${draft.id}`} car={draft} onChange={media => setDraft(current => current ? { ...current, ...media } : current)} onBusy={setMediaBusy} onUploaded={sources => { pendingMedia.current.push(...sources); }} />
          <CarSpecsEditor key={`specs-${draft.id}`} car={draft} onChange={setDraft} />
          <CarTextEditor key={`text-${draft.id}`} car={draft} onChange={setDraft} />
          <fieldset><legend>{t("Основные данные")}</legend><div className="admin-form-grid">
            <label>{t("Цена, USD")}<input type="number" min={carPriceMin} max={carPriceMax} step="1" value={draft.price || ''} onChange={event => updateDraft('price', Number(event.target.value))} required /><small>{t('Целое число от 1 до 100 000 000 USD.')}</small></label>
            <label>{t("Год выпуска")}<input type="number" list="admin-year-options" min="2000" max="2035" value={draft.year || ''} onChange={event => updateDraft('year', Number(event.target.value))} required /><datalist id="admin-year-options">{years.map(year => <option key={year} value={year} />)}</datalist></label>
            <label>VIN<input maxLength={64} value={draft.vin ?? ''} onChange={event => updateDraft('vin', event.target.value)} /></label>
            <label>{t('Код автомобиля')}<input maxLength={160} value={draft.carCode ?? ''} onChange={event => updateDraft('carCode', event.target.value)} /></label>
            <label>{t('Дата публикации')}<input type="date" value={draft.listedAt ?? ''} onChange={event => updateDraft('listedAt', event.target.value || undefined)} /></label>
            <label>{t('Цена FOB, USD')}<input type="number" min={carPriceMin} max={carPriceMax} step="1" value={draft.fobPrice ?? ''} onChange={event => updateDraft('fobPrice', event.target.value === '' ? undefined : Number(event.target.value))} /></label>
            <label>{t("Тип оформления")}<select value={draft.customsType ?? ''} onChange={event => updateDraft('customsType', event.target.value ? event.target.value as CustomsType : undefined)}><option value="">{t("Не указано")}</option>{customsTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
          </div></fieldset>
          <fieldset><legend>{t("Публикация")}</legend><div className="admin-form-grid">
            <label>{t("Статус")}<select value={draft.status} onChange={event => updateDraft('status', event.target.value as CarStatus)}>{statuses.map(status => <option key={status} value={status}>{t(status)}</option>)}</select></label>
            <label>{t("Состояние")}<select value={draft.condition} onChange={event => updateDraft('condition', event.target.value as CarCondition)}>{conditions.map(condition => <option key={condition} value={condition}>{t(condition)}</option>)}</select></label>
          </div></fieldset>
        </fieldset>
        <div className="admin-editor-tip"><span>✦</span><p>{t("Сохранённое объявление сразу появится на сайте.")}</p></div>
        {editorError && <p className="admin-media-error" role="alert">{t(editorError)}</p>}
        </div>
        <footer><button type="button" className="admin-cancel" disabled={busy} onClick={closeEditor}>{t("Отмена")}</button><button className="admin-primary" type="submit" disabled={busy || !loaded}>{t(busy ? 'Сохраняем…' : 'Сохранить объявление')} <span>↗</span></button></footer>
      </form>
    </div>}
    {deleting && <div className="admin-editor-layer" role="dialog" aria-modal="true" aria-label={t("Удаление объявления")}><div className="admin-editor-backdrop" /><div className="admin-delete-card"><h2>{t("Удалить объявление?")}</h2><p>{deleting.brand} {deleting.model}  {t("исчезнет из каталога и с сайта. Восстановить его автоматически не получится.")}</p><div><button className="admin-cancel" disabled={saving} onClick={() => setDeleting(null)}>{t("Отмена")}</button><button className="admin-primary" disabled={saving} onClick={() => void archiveCar()}>{t(saving ? 'Удаляем…' : 'Удалить объявление')}</button></div></div></div>}
    {toast && <div className="admin-toast" role="status">{t(toast)}<button type="button" aria-label={t("Закрыть уведомление")} onClick={() => setToast('')}>×</button></div>}
  </>;
}
