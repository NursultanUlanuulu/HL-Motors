'use client';

import { useLocale } from '@/components/LocaleProvider';

import { FormEvent, useMemo, useState } from 'react';
import { carCount } from '@/lib/i18n';
import { brandLabel } from '@/lib/car-translations';
import { useSiteData } from './SiteDataProvider';
import { catalogOptions } from '@/lib/site-data';
import { VehicleCard } from './VehicleCard';

type Filters = { brand: string; status: string; price: string; year: string; condition: string; sort: 'asc' | 'desc' };
const initialFilters: Filters = { brand: '', status: '', price: '', year: '', condition: '', sort: 'asc' };

export function HomeCatalog() {
  const { locale, t } = useLocale();
  const { cars, loaded, error } = useSiteData();
  const { brands, years } = catalogOptions(cars);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [open, setOpen] = useState(false);
  const visibleCars = useMemo(() => {
    const priceLimit = Number(filters.price || Infinity);
    return cars.filter((car) => (!filters.brand || car.brand === filters.brand) && (!filters.status || car.status === filters.status) && car.price <= priceLimit && (!filters.year || String(car.year) === filters.year) && (!filters.condition || car.condition === filters.condition)).sort((a, b) => filters.sort === 'desc' ? b.price - a.price : a.price - b.price);
  }, [cars, filters]);
  const update = (key: keyof Filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    document.querySelector('#catalog')?.scrollIntoView({ behavior: 'smooth' });
  }

  if (!loaded) return <section id="catalog" className="catalog section-space" role="status">{t(error || 'Загружаем каталог…')}</section>;

  return <>
    <section className="quick-search" aria-label={t("Быстрый поиск автомобиля")}>
      <div className="quick-search-title"><span className="section-number">01</span><h2>{t("Найдите свой автомобиль")}</h2></div>
      <form className="filter-row" onSubmit={applySearch}>
        <label><span>{t("Марка")}</span><select value={filters.brand} onChange={(event) => update('brand', event.target.value)}><option value="">{t("Любая марка")}</option>{brands.map(brand => <option key={brand} value={brand}>{brandLabel(brand, cars, locale)}</option>)}</select></label>
        <label><span>{t("Статус")}</span><select value={filters.status} onChange={(event) => update('status', event.target.value)}><option value="">{t("Любой статус")}</option><option value="В наличии">{t("В наличии")}</option><option value="В пути">{t("В пути")}</option><option value="Под заказ">{t("Под заказ")}</option></select></label>
        <label><span>{t("Бюджет")}</span><select value={filters.price} onChange={(event) => update('price', event.target.value)}><option value="">{t("Любой бюджет")}</option><option value="50000">{t("до $50 000")}</option><option value="80000">{t("до $80 000")}</option><option value="120000">{t("до $120 000")}</option></select></label>
        <button className="button button-dark" type="submit">{t("Найти")} <span>↗</span></button>
      </form>
    </section>
    <section id="catalog" className="catalog section-space" aria-labelledby="catalog-title">
      <div className="section-header"><div><p className="eyebrow"><span className="section-number">02</span>  {t("Актуальные предложения")}</p><h2 id="catalog-title">{t("Автомобили")}<br /><em>{t("в вашем ритме")}</em></h2></div><div className="catalog-actions"><p>{carCount(visibleCars.length, locale)}</p><button className="filter-button" aria-expanded={open} onClick={() => setOpen(!open)}><span className="filter-icon">≡</span>  {t("Все фильтры")}</button></div></div>
      <div className={`filter-panel ${open ? 'open' : ''}`}>
        <label>{t("Год")}<select value={filters.year} onChange={(event) => update('year', event.target.value)}><option value="">{t("Любой год")}</option>{years.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
        <label>{t("Тип")}<select value={filters.condition} onChange={(event) => update('condition', event.target.value)}><option value="">{t("Любое состояние")}</option><option value="Новый">{t("Новый")}</option><option value="С пробегом">{t("С пробегом")}</option></select></label>
        <label>{t("Сортировка")}<select value={filters.sort} onChange={(event) => update('sort', event.target.value as Filters['sort'])}><option value="asc">{t("Сначала дешевле")}</option><option value="desc">{t("Сначала дороже")}</option></select></label>
        <button className="reset-button" type="button" onClick={() => setFilters(initialFilters)}>{t("Сбросить")}</button>
      </div>
      <div className="catalog-grid">{visibleCars.map((car) => <VehicleCard car={car} key={car.id} />)}</div>
      {visibleCars.length === 0 && <div className="empty-state">{t("По этим параметрам автомобилей пока нет. Попробуйте изменить фильтры.")}</div>}
      <a className="catalog-more" href="/#contacts">{t("Нужна другая модель?")} <span>{t("Подберём под заказ")}</span> <b>↗</b></a>
    </section>
  </>;
}
