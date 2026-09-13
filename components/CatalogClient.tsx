'use client';

import { useLocale } from '@/components/LocaleProvider';

import { useMemo, useState } from 'react';
import { carCount } from '@/lib/i18n';
import { brandLabel } from '@/lib/car-translations';
import { useSiteData } from './SiteDataProvider';
import { catalogOptions } from '@/lib/site-data';
import { VehicleCard } from './VehicleCard';

type Filters = { brand: string; status: string; price: string; year: string; condition: string; sort: 'asc' | 'desc' };
const initialFilters: Filters = { brand: '', status: '', price: '', year: '', condition: '', sort: 'asc' };

export function CatalogClient() {
  const { locale, t } = useLocale();
  const { cars, loaded, error } = useSiteData();
  const { brands, years } = catalogOptions(cars);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const visibleCars = useMemo(() => {
    const priceLimit = Number(filters.price || Infinity);
    return cars.filter((car) => (!filters.brand || car.brand === filters.brand) && (!filters.status || car.status === filters.status) && (!filters.year || String(car.year) === filters.year) && (!filters.condition || car.condition === filters.condition) && car.price <= priceLimit).sort((a, b) => filters.sort === 'desc' ? b.price - a.price : a.price - b.price);
  }, [cars, filters]);
  const update = (key: keyof Filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  if (!loaded) return <section className="catalog-page-content" role="status">{t(error || 'Загружаем каталог…')}</section>;
  return <section className="catalog-page-content"><div className="catalog-toolbar"><button className="catalog-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><span>{t("Фильтры")}</span><b>{filtersOpen ? '−' : '+'}</b></button><p>{carCount(visibleCars.length, locale)}</p><label className="sort-select">{t("Сортировка")}<select value={filters.sort} onChange={(event) => update('sort', event.target.value as Filters['sort'])}><option value="asc">{t("Сначала дешевле")}</option><option value="desc">{t("Сначала дороже")}</option></select></label></div><div className="catalog-layout"><aside className={`catalog-sidebar ${filtersOpen ? '' : 'closed'}`}><div className="sidebar-title"><strong>{t("Подобрать автомобиль")}</strong><button type="button" onClick={() => setFilters(initialFilters)}>{t("Сбросить")}</button></div><label>{t("Марка")}<select value={filters.brand} onChange={(event) => update('brand', event.target.value)}><option value="">{t("Все марки")}</option>{brands.map((brand) => <option key={brand} value={brand}>{brandLabel(brand, cars, locale)}</option>)}</select></label><label>{t("Статус")}<select value={filters.status} onChange={(event) => update('status', event.target.value)}><option value="">{t("Любой статус")}</option><option value="В наличии">{t("В наличии")}</option><option value="В пути">{t("В пути")}</option><option value="Под заказ">{t("Под заказ")}</option></select></label><label>{t("Цена до")}<select value={filters.price} onChange={(event) => update('price', event.target.value)}><option value="">{t("Без ограничения")}</option><option value="60000">$60 000</option><option value="90000">$90 000</option><option value="120000">$120 000</option></select></label><label>{t("Год")}<select value={filters.year} onChange={(event) => update('year', event.target.value)}><option value="">{t("Любой год")}</option>{years.map(year => <option key={year} value={year}>{year}</option>)}</select></label><label>{t("Состояние")}<select value={filters.condition} onChange={(event) => update('condition', event.target.value)}><option value="">{t("Любое состояние")}</option><option value="Новый">{t("Новый")}</option><option value="С пробегом">{t("С пробегом")}</option></select></label><div className="sidebar-note"><span>✦</span><p>{t("Не нашли нужную комплектацию? Найдём автомобиль на аукционах и у дилеров Китая.")}</p><a href="/#contacts">{t("Оставить заявку ↗")}</a></div></aside><div><div className="catalog-page-grid">{visibleCars.map((car) => <VehicleCard key={car.id} car={car} catalog />)}</div>{visibleCars.length === 0 && <p className="catalog-empty">{t("По этим параметрам пока нет автомобилей. Попробуйте сбросить фильтры.")}</p>}</div></div></section>;
}
