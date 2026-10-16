'use client';
import { Fragment } from 'react';
import type { Car } from '@/lib/cars';
import { optionLabel, specNumbers, specSelects } from '@/lib/vehicle-specs';
import { useLocale } from './LocaleProvider';

export function VehicleExtraSpecs({ car }: { car: Car }) {
  const { locale, t } = useLocale();
  const rows: [string, string][] = [];
  for (const [key, label] of specSelects) {
    if (['bodyType', 'color', 'transmission', 'driveType'].includes(key)) continue;
    const value = car.specs?.[key];
    if (value) rows.push([label, optionLabel(key, value, locale)]);
  }
  for (const [key, label] of specNumbers) {
    if (key === 'mileageKm' || key === 'powerHp') continue;
    const value = car.specs?.[key];
    if (value !== undefined) rows.push([label, new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value)]);
  }
  if (car.specs?.registrationDate) rows.push(['Дата регистрации', car.specs.registrationDate]);
  if (car.carCode) rows.push(['Код автомобиля', car.carCode]);
  if (car.listedAt) rows.push(['Дата публикации', car.listedAt]);
  if (car.fobPrice !== undefined) rows.push(['Цена FOB, USD', new Intl.NumberFormat(locale).format(car.fobPrice)]);
  return <>
    {rows.length > 0 && <div className="spec-section"><h3>{t('Дополнительные характеристики')}</h3><dl className="spec-grid">{rows.map(([label, value]) => <Fragment key={label}><dt>{t(label)}</dt><dd>{value}</dd></Fragment>)}</dl></div>}
    {!!car.featureTags?.length && <div className="spec-section"><h3>{t('Метки состояния и предложения')}</h3><ul className="vehicle-feature-tags">{car.featureTags.map(id => <li key={id}>{optionLabel('featureTags', id, locale)}</li>)}</ul></div>}
    {car.highlights && <div className="spec-section"><h3>{t('Краткие преимущества')}</h3><p className="vehicle-free-text">{car.highlights}</p></div>}
    {car.remark && <div className="spec-section"><h3>{t('Описание и замечания')}</h3><p className="vehicle-free-text">{car.remark}</p></div>}
  </>;
}
