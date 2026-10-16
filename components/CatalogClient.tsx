'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLocale } from './LocaleProvider';
import { useSiteData } from './SiteDataProvider';
import { useFavorites } from './FavoritesProvider';
import { carCount } from '@/lib/i18n';
import { brandLabel, modelLabel } from '@/lib/car-translations';
import { filterMarketCars, marketDefaults, marketQuery, readMarketFilters, type MarketFilters as Values } from '@/lib/marketplace-filters';
import { optionLabel, specSelects } from '@/lib/vehicle-specs';
import { VehicleCard } from './VehicleCard';
import { MarketFilters } from './MarketFilters';
import { MarketIcon } from './MarketIcon';

const pageSize = 12;
const numericLabels: Record<string, string> = { minPrice: 'Цена от, USD', maxPrice: 'Цена до, USD', minYear: 'Год от', maxYear: 'Год до', minMileage: 'Пробег от, км', maxMileage: 'Пробег до, км', minPower: 'Мощность от, л.с.', maxPower: 'Мощность до, л.с.' };
export function CatalogClient({ favorites = false }: { favorites?: boolean }) {
  const { locale, t } = useLocale();
  const { cars, loaded, error, refresh } = useSiteData();
  const { ids, ready, saved } = useFavorites();
  const params = useSearchParams();
  const pathname = usePathname();
  const value = readMarketFilters(new URLSearchParams(params.toString()));
  const [search, setSearch] = useState(value.query);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const results = useRef<HTMLDivElement>(null);
  useEffect(() => setSearch(value.query), [value.query]);
  const source = favorites ? cars.filter(car => ids.includes(car.id)) : cars;
  const visible = filterMarketCars(source, value);
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const page = Math.min(Number(value.page), pages);
  const items = visible.slice((page - 1) * pageSize, page * pageSize);
  const query = marketQuery(value);
  const returnHref = pathname + (query ? '?' + query : '');
  const active = (Object.entries(value) as [keyof Values, string][]).filter(([key, entry]) => entry && !['sort', 'page'].includes(key));
  const invalidRange = (['Price', 'Year', 'Mileage', 'Power'] as const).some(field => value[`min${field}`] && value[`max${field}`] && Number(value[`min${field}`]) > Number(value[`max${field}`]));
  function navigate(next: Values) {
    const nextQuery = marketQuery(next);
    window.history.replaceState(null, '', pathname + (nextQuery ? '?' + nextQuery : ''));
  }
  function update(key: keyof Values, input: string) {
    navigate({ ...value, [key]: input, ...(key === 'brand' ? { model: '' } : {}), ...(key !== 'page' ? { page: '1' } : {}) });
  }
  function reset() { setSearch(''); navigate({ ...marketDefaults }); }
  function close() { dialog.current?.close(); setMobileOpen(false); }
  useEffect(() => {
    if (!mobileOpen) return;
    dialog.current?.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const media = matchMedia('(min-width: 901px)');
    const resized = () => { if (media.matches) close(); };
    media.addEventListener('change', resized);
    return () => { document.body.style.overflow = oldOverflow; media.removeEventListener('change', resized); dialog.current?.close(); };
  }, [mobileOpen]);
  function chip(key: keyof Values, input: string): string {
    if (key === 'brand') return brandLabel(input, cars, locale);
    if (key === 'model') return modelLabel(input, cars, locale, value.brand);
    if (key === 'query') return '«' + input + '»';
    if (key === 'condition' || key === 'status') return input.split('|').map(item => t(item)).join(', ');
    if (numericLabels[key]) return t(numericLabels[key]) + ': ' + input;
    const field = [...specSelects, ['featureTags', 'Метки состояния и предложения'] as const].find(([id]) => id === key);
    return field ? t(field[1]) + ': ' + input.split('|').map(id => optionLabel(field[0], id, locale)).join(', ') : input;
  }
  const filters = <MarketFilters cars={source} value={value} update={update} reset={reset} />;
  const loading = !loaded || (favorites && !ready);
  return <main className="market-main">
    <div className="market-title-row"><div><h1>{t(favorites ? 'Избранное' : 'Автомобили из Китая')}</h1><p role="status" aria-live="polite">{loading ? t('Загружаем каталог…') : carCount(visible.length, locale)}</p></div><form className="market-search" role="search" onSubmit={event => { event.preventDefault(); update('query', search.trim()); }}><label><MarketIcon name="search" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} aria-label={t('Поиск автомобилей')} placeholder={t('Марка, модель или ключевое слово')} /></label><button type="submit" className="market-primary">{t('Найти')}</button></form></div>
    {!saved && <p className="market-notice" role="status">{t('Избранное сохранится только до закрытия страницы: хранилище браузера недоступно.')}</p>}
    {favorites && <p className="market-favorites-note">{t('Сохранённые автомобили в этом браузере.')} <Link href="/catalog">{t('Перейти в каталог')} ↗</Link></p>}
    <div className="market-layout"><aside className="market-desktop-filters">{filters}</aside><div className="market-results" ref={results}>
      <div className="market-toolbar"><button type="button" className="market-filter-toggle" onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen} aria-controls="market-filter-dialog"><MarketIcon name="filter" />{t('Фильтры')}{active.length > 0 && <b>{active.length}</b>}</button><div className="market-chips">{active.map(([key, input]) => <button key={key} type="button" aria-label={t('Убрать фильтр') + ': ' + chip(key, input)} onClick={() => update(key, '')}>{chip(key, input)}<MarketIcon name="close" /></button>)}{active.length > 0 && <button className="market-reset" type="button" onClick={reset}>{t('Сбросить')}</button>}</div><label className="market-sort"><span>{t('Сортировка')}</span><select value={value.sort} onChange={event => update('sort', event.target.value)}><option value="asc">{t('Сначала дешевле')}</option><option value="desc">{t('Сначала дороже')}</option><option value="newest">{t('Сначала новее')}</option></select></label></div>
      {error && <div className="market-notice" role="alert"><p>{t(error)}</p><button className="market-secondary" onClick={() => void refresh()}>{t('Повторить')}</button></div>}
      {invalidRange && <p className="market-notice" role="alert">{t('Значение «От» не должно превышать «До».')}</p>}
      {loading && !error ? <div className="market-cars" aria-busy="true">{Array.from({ length: 6 }, (_, index) => <div className="market-skeleton" key={index} />)}</div> : !loading && <><div className="market-cars">{items.map(car => <VehicleCard key={car.id} car={car} returnHref={returnHref} />)}</div>{!visible.length && <section className="market-empty"><MarketIcon name={favorites && !source.length ? 'heart' : 'search'} /><h2>{t(favorites && !source.length ? 'Здесь будут понравившиеся автомобили' : 'Ничего не найдено')}</h2><p>{t(favorites && !source.length ? 'Нажмите на сердечко в карточке, чтобы сохранить автомобиль.' : 'Попробуйте изменить параметры поиска или сбросить фильтры.')}</p>{favorites && !source.length ? <Link className="market-primary" href="/catalog">{t('Перейти в каталог')}</Link> : <button className="market-primary" onClick={reset}>{t('Сбросить фильтры')}</button>}</section>}
      {pages > 1 && <nav className="market-pagination" aria-label={t('Страницы каталога')}><button disabled={page === 1} onClick={() => { update('page', String(page - 1)); results.current?.scrollIntoView({ block: 'start' }); }} aria-label={t('Предыдущая страница')}>←</button>{Array.from({ length: pages }, (_, i) => i + 1).filter(n => n === 1 || n === pages || Math.abs(n - page) <= 1).map((n, index, list) => <span key={n}>{index > 0 && n - list[index - 1] > 1 && <span className="market-ellipsis">…</span>}<button aria-label={t('Страница {number}', { number: n })} aria-current={n === page ? 'page' : undefined} onClick={() => { update('page', String(n)); results.current?.scrollIntoView({ block: 'start' }); }}>{n}</button></span>)}<button disabled={page === pages} onClick={() => { update('page', String(page + 1)); results.current?.scrollIntoView({ block: 'start' }); }} aria-label={t('Следующая страница')}>→</button></nav>}</>}
    </div></div>
    <dialog ref={dialog} id="market-filter-dialog" className="market-filter-dialog" aria-label={t('Фильтры')} onClose={() => setMobileOpen(false)} onClick={event => { if (event.target === event.currentTarget) close(); }}><div className="market-mobile-filter-inner"><button type="button" className="market-close" onClick={close} aria-label={t('Закрыть')}><MarketIcon name="close" /></button>{mobileOpen && filters}<div className="market-filter-done"><button className="market-primary" onClick={close}>{t('Показать автомобили')} · {visible.length}</button></div></div></dialog>
  </main>;
}
