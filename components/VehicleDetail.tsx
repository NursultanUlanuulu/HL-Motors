'use client';
import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from './LocaleProvider';
import { MarketFrame } from './MarketFrame';
import { VehicleGallery } from './VehicleGallery';
import { VehicleExtraSpecs } from './VehicleExtraSpecs';
import { FavoriteButton } from './FavoriteButton';
import { useSiteData } from './SiteDataProvider';
import { localizeCar } from '@/lib/car-translations';
import { formatPrice } from '@/lib/cars';
import { ManagerContacts } from './ManagerContacts';

export function VehicleDetail({ id }: { id: string }) {
  const { locale, t } = useLocale();
  const { cars, loaded, error, refresh } = useSiteData();
  const [back, setBack] = useState('/catalog');
  const originalCar = cars.find(item => item.id === id);
  const car = originalCar ? localizeCar(originalCar, locale) : undefined;
  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get('back');
    if (target && /^\/(?:catalog|favorites)?(?:\?|$)/.test(target)) setBack(target);
  }, [id]);
  useEffect(() => {
    if (loaded) document.title = car ? (car.metaTitle || car.brand + ' ' + car.model) + ' — Motors' : t('Автомобиль недоступен — Motors');
  }, [car?.brand, car?.model, car?.metaTitle, loaded, locale]);
  useEffect(() => {
    if (!car?.metaDescription) return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previous = meta?.content;
    if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.append(meta); }
    meta.content = car.metaDescription;
    return () => { if (previous === undefined) meta.remove(); else meta.content = previous; };
  }, [car?.metaDescription]);
  if (!loaded) return <MarketFrame catalog><main className="market-main"><p role="status">{t(error || 'Загружаем автомобиль…')}</p>{error && <button className="market-primary" onClick={() => void refresh()}>{t('Повторить')}</button>}</main></MarketFrame>;
  if (!car) return <MarketFrame catalog><main className="market-main market-empty"><h1>{t('Автомобиль недоступен')}</h1><p>{t('Объявление снято с публикации или отсутствует в этом браузере.')}</p><Link className="market-primary" href={back}>{t('Вернуться в каталог')}</Link></main></MarketFrame>;
  const gallery = car.gallery?.length ? car.gallery : car.image ? [car.image] : [];
  const whatsappText = t('Здравствуйте! Интересует {name}. Номер объявления: {id}. Год: {year}. Цена: ${price}. Статус: {status}.', { name: car.brand + ' ' + car.model, id: car.id, year: car.year, price: formatPrice(car.price), status: t(car.status) });

  const specs = [
    ['Год выпуска', String(car.year)], ['Пробег', car.mileage], ['Состояние', t(car.condition)],
    ['Тип кузова', car.body], ['Двигатель', car.engine], ['Мощность', car.power],
    ['Коробка передач', car.transmission], ['Привод', car.drive], ['Цвет кузова', car.color],
    ['VIN', car.vin], ['Тип оформления', car.customsType],
  ].filter((row): row is [string, string] => !!row[1]);
  const status = <span className={'market-status ' + (car.status === 'В наличии' ? 'available' : car.status === 'В пути' ? 'transit' : 'order')}>{t(car.status)}</span>;
  return <MarketFrame catalog><main className="market-main market-detail">
    <nav className="market-breadcrumbs" aria-label={t('Навигация по страницам')}><Link href={back}>{t('← К результатам')}</Link><span>/</span><span>{car.brand} {car.model}</span></nav>
    <div className="market-detail-heading"><div><h1>{car.brand} {car.model}</h1>{car.title && <p>{car.title}</p>}<p>{car.trim} · {car.year} · {car.mileage}</p></div><div className="market-detail-actions"><FavoriteButton id={car.id} label /></div></div>
    <div className="market-detail-grid"><div className="market-detail-content"><VehicleGallery key={car.id + gallery.join('|')} gallery={gallery} name={car.brand + ' ' + car.model} videoSource={car.video} />
      <section className="market-specs-panel"><div className="spec-section"><h3>{t('Основные характеристики')}</h3><dl className="spec-grid">{specs.map(([label, val]) => <Fragment key={label}><dt>{t(label)}</dt><dd>{val}</dd></Fragment>)}</dl></div><VehicleExtraSpecs car={car} /></section>
      <section className="market-specs-panel"><div className="spec-section"><h3>{t('Местонахождение')}</h3><p>{car.city} · {t(car.status)}</p></div><div className="spec-section"><h3>{t('Доставка и оплата')}</h3><p className="vehicle-free-text">{t('Статус и состав цены зависят от страны доставки. Менеджер подготовит расчёт под ключ с учётом таможенного оформления, лаборатории и регистрации.')}</p></div><ManagerContacts message={whatsappText} asButton label="Уточнить условия ↗" className="market-secondary" /></section>
    </div><aside className="market-contact-card"><strong>${formatPrice(car.price)}</strong><small>{t('Ориентировочная цена в USD')}</small><div className="market-contact-status">{status}<span>{car.city}</span></div><ManagerContacts message={whatsappText} /><FavoriteButton id={car.id} label /><p>{t('Свяжитесь с менеджером — он отправит подробный отчёт, ответит на вопросы и зафиксирует условия.')}</p></aside></div>
  </main><div className="market-mobile-contact"><div><strong>${formatPrice(car.price)}</strong><div>{status}</div></div><ManagerContacts message={whatsappText} asButton label="Связаться" /></div></MarketFrame>;
}
