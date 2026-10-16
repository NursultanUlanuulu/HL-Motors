'use client';

import { useState } from 'react';
import type { Car } from '@/lib/cars';
import { vehicleOptions } from '@/lib/vehicle-dictionaries';
import { carNumeric, carOption, canonicalBrand, dictionaryBrand, legacyOptionText, selectableBrands, specNumbers, specSelects, type VehicleSpecs } from '@/lib/vehicle-specs';
import { useLocale } from './LocaleProvider';

export function CarSpecsEditor({ car, onChange }: { car: Car; onChange: (car: Car) => void }) {
  const { locale, t } = useLocale();
  const [brandQuery, setBrandQuery] = useState('');
  const brand = canonicalBrand(car.brand);
  const brands = [...new Set([...(brand ? [brand] : []), ...selectableBrands])].filter(value => value === brand || `${value} ${dictionaryBrand(value, 'zh') ?? ''} ${dictionaryBrand(value, 'en') ?? ''}`.toLowerCase().includes(brandQuery.toLowerCase()));
  function update<K extends keyof VehicleSpecs>(key: K, value: VehicleSpecs[K]) {
    const specs = { ...car.specs };
    if (value === undefined) delete specs[key]; else specs[key] = value;
    // Clear only the legacy counterpart of an explicitly edited field.
    const legacy = { driveType: 'drive', bodyType: 'body', color: 'color', transmission: 'transmission', mileageKm: 'mileage', powerHp: 'power' } as const;
    const field = key in legacy ? legacy[key as keyof typeof legacy] : undefined;
    const translations = car.translations ? structuredClone(car.translations) : undefined;
    if (field && translations) for (const text of Object.values(translations)) if (text) delete text[field];
    onChange({ ...car, specs, ...(field ? { [field]: '' } : {}), ...(translations ? { translations } : {}) });
  }
  function selectBrand(value: string) {
    const translations = car.translations ? structuredClone(car.translations) : undefined;
    if (translations) for (const text of Object.values(translations)) if (text) delete text.brand;
    onChange({ ...car, brand: value, ...(translations ? { translations } : {}) });
  }
  return <fieldset><legend>{t('Характеристики')}</legend>
    <p className="admin-media-help">{t('Технические значения выбираются один раз и переводятся при переключении языка.')}</p>
    <div className="admin-form-grid">
      <label>{t('Поиск марки')}<input type="search" value={brandQuery} onChange={event => setBrandQuery(event.target.value)} /></label>
      <label>{t('Марка')}<select required value={brand} onChange={event => selectBrand(event.target.value)}><option value="">{t('Выберите марку')}</option>{brands.map(value => <option key={value} value={value}>{dictionaryBrand(value, locale) ?? value}</option>)}</select></label>
      {specSelects.map(([key, label]) => {
        const current = carOption(car, key);
        const legacy = !current && legacyOptionText(car, key);
        return <label key={key}>{t(label)}<select value={current || (legacy ? '__legacy__' : '')} onChange={event => { if (event.target.value !== '__legacy__') update(key, event.target.value || undefined); }}><option value="">{t('Не указано')}</option>{legacy && <option value="__legacy__">{t(legacy)}</option>}{vehicleOptions[key].map(option => <option key={option.id} value={option.id}>{option[locale]}</option>)}</select></label>;
      })}
      {specNumbers.map(([key, label, min, max, step]) => <label key={key}>{t(label)}<input type="number" min={min} max={max} step={step} value={car.specs?.[key] ?? (key === 'mileageKm' || key === 'powerHp' ? carNumeric(car, key) : undefined) ?? ''} onChange={event => update(key, event.target.value === '' ? undefined : Number(event.target.value))} /></label>)}
      <label>{t('Дата регистрации')}<input type="date" value={car.specs?.registrationDate ?? ''} onChange={event => update('registrationDate', event.target.value || undefined)} /></label>
    </div>
    <fieldset className="vehicle-tag-editor"><legend>{t('Метки состояния и предложения')}</legend><div className="vehicle-tag-options">{vehicleOptions.featureTags.map(option => <label key={option.id}><input type="checkbox" checked={car.featureTags?.includes(option.id) ?? false} onChange={event => onChange({ ...car, featureTags: event.target.checked ? [...(car.featureTags ?? []), option.id] : (car.featureTags ?? []).filter(id => id !== option.id) })} /><span>{option[locale]}</span></label>)}</div></fieldset>
  </fieldset>;
}
