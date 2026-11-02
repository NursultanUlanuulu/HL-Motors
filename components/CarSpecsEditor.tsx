'use client';

import { useMemo } from 'react';
import type { Car } from '@/lib/cars';
import { optionsFor } from '@/lib/custom-options';
import { AddDictionaryOption } from './AddDictionaryOption';
import { useSiteData } from './SiteDataProvider';
import { carNumeric, carOption, canonicalBrand, legacyOptionText, specNumbers, specSelects, type VehicleSpecs } from '@/lib/vehicle-specs';
import { useLocale } from './LocaleProvider';
import { SearchSelect } from './SearchSelect';
import { brandSelectOptions } from '@/lib/select-options';

export function CarSpecsEditor({ car, onChange }: { car: Car; onChange: (car: Car) => void }) {
  const { locale, t } = useLocale();
  const { cars, options } = useSiteData();
  const brand = canonicalBrand(car.brand);
  const brands = useMemo(() => brandSelectOptions([...cars, car], locale, options).map(({ count, ...option }) => option), [cars, car.brand, locale, options]);
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
      <div><SearchSelect label={t('Марка')} value={brand} required onChange={selectBrand} placeholder={t('Выберите марку')} options={brands} /><AddDictionaryOption label={t('Марка')} group="brand" onSelect={selectBrand} /></div>
      {specSelects.map(([key, label]) => {
        const current = carOption(car, key);
        const legacy = !current && legacyOptionText(car, key);
        return <div key={key}><SearchSelect label={t(label)} value={current || (legacy ? '__legacy__' : '')} onChange={value => { if (value !== '__legacy__') update(key, value || undefined); }} placeholder={t('Не указано')} options={[...(legacy ? [{ value: '__legacy__', label: t(legacy) }] : []), ...optionsFor(options, key).map(option => ({ value: option.id, label: option[locale], keywords: [option.ru, option.en, option.zh, ...option.sources].join(' ') }))]} /><AddDictionaryOption group={key} label={t(label)} onSelect={value => update(key, value)} /></div>;
      })}
      {specNumbers.map(([key, label, min, max, step]) => <label key={key}>{t(label)}<input type="number" min={min} max={max} step={step} value={car.specs?.[key] ?? (key === 'mileageKm' || key === 'powerHp' ? carNumeric(car, key) : undefined) ?? ''} onChange={event => update(key, event.target.value === '' ? undefined : Number(event.target.value))} /></label>)}
      <label>{t('Дата регистрации')}<input type="date" value={car.specs?.registrationDate ?? ''} onChange={event => update('registrationDate', event.target.value || undefined)} /></label>
    </div>
    <fieldset className="vehicle-tag-editor"><legend>{t('Метки состояния и предложения')}</legend><div className="vehicle-tag-options">{optionsFor(options, 'featureTags').map(option => <label key={option.id}><input type="checkbox" checked={car.featureTags?.includes(option.id) ?? false} onChange={event => onChange({ ...car, featureTags: event.target.checked ? [...(car.featureTags ?? []), option.id] : (car.featureTags ?? []).filter(id => id !== option.id) })} /><span>{option[locale]}</span></label>)}</div><AddDictionaryOption group="featureTags" label={t('Метки состояния и предложения')} onSelect={id => onChange({ ...car, featureTags: [...new Set([...(car.featureTags ?? []), id])] })} /></fieldset>
  </fieldset>;
}
