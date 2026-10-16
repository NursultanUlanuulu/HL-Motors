'use client';
import type { Car } from '@/lib/cars';
import { useMemo } from 'react';
import { brandSelectOptions, modelSelectOptions } from '@/lib/select-options';
import { SearchSelect } from './SearchSelect';
import { vehicleOptions } from '@/lib/vehicle-dictionaries';
import { optionId, specSelects } from '@/lib/vehicle-specs';
import type { MarketFilters as Values } from '@/lib/marketplace-filters';
import { useLocale } from './LocaleProvider';

export function MarketFilters({ cars, value, update, reset }: { cars: Car[]; value: Values; update: (key: keyof Values, value: string) => void; reset: () => void }) {
  const { locale, t } = useLocale();
  const brands = useMemo(() => brandSelectOptions(cars, locale), [cars, locale]);
  const models = useMemo(() => modelSelectOptions(cars, value.brand, locale), [cars, value.brand, locale]);
  const fuelMain = ['Gasoline', 'Pure electric', 'Plug-in hybrid'].map(label => optionId('fuelType', label));
  function toggle(key: 'fuelType' | 'condition', item: string) {
    const selected = value[key].split('|').filter(Boolean);
    update(key, selected.includes(item) ? selected.filter(id => id !== item).join('|') : [...selected, item].join('|'));
  }
  function range(label: string, min: keyof Values, max: keyof Values, limit: number) {
    return <fieldset className="market-range"><legend>{t(label)}</legend><div><input type="number" min="0" max={limit} inputMode="numeric" aria-label={`${t(label)}: ${t('От')}`} placeholder={t('От')} value={value[min]} onChange={event => update(min, event.target.value)} /><span>—</span><input type="number" min="0" max={limit} inputMode="numeric" aria-label={`${t(label)}: ${t('До')}`} placeholder={t('До')} value={value[max]} onChange={event => update(max, event.target.value)} /></div></fieldset>;
  }
  function choice(key: typeof specSelects[number][0] | 'featureTags', label: string) {
    return <div className="market-field"><SearchSelect label={t(label)} value={value[key]} onChange={value => update(key, value)} placeholder={t('Все')} options={vehicleOptions[key].map(item => ({ value: item.id, label: item[locale], keywords: [item.ru, item.en, item.zh, ...item.sources].join(' ') }))} /></div>;
  }
  const fuelCheckbox = (item: typeof vehicleOptions.fuelType[number]) => <label className="market-check" key={item.id}><input type="checkbox" checked={value.fuelType.split('|').includes(item.id)} onChange={() => toggle('fuelType', item.id)} />{item[locale]}</label>;
  return <div className="market-filter-content">
    <div className="market-filter-title"><h2>{t('Фильтры')}</h2><button type="button" className="market-text-button" onClick={reset}>{t('Сбросить')}</button></div>
    <div className="market-field"><SearchSelect label={t('Марка')} value={value.brand} onChange={value => update('brand', value)} placeholder={t('Все марки')} options={brands} /></div>
    <div className="market-field"><SearchSelect label={t('Модель')} value={value.model} onChange={value => update('model', value)} placeholder={t('Все модели')} options={models} /><small className="market-field-help">{t('Модели из объявлений каталога')}</small></div>
    {range('Цена, $', 'minPrice', 'maxPrice', 100000000)}
    {range('Год выпуска', 'minYear', 'maxYear', 2100)}
    {range('Пробег, км', 'minMileage', 'maxMileage', 10000000)}
    <fieldset className="market-checks"><legend>{t('Топливо')}</legend>{vehicleOptions.fuelType.filter(item => fuelMain.includes(item.id)).map(fuelCheckbox)}<details className="market-more-fuel"><summary>{t('Другие типы топлива')}</summary>{vehicleOptions.fuelType.filter(item => !fuelMain.includes(item.id)).map(fuelCheckbox)}</details></fieldset>
    <fieldset className="market-checks"><legend>{t('Состояние')}</legend><div className="market-inline-checks">{['Новый', 'С пробегом'].map(item => <label key={item} className="market-check"><input type="checkbox" checked={value.condition.split('|').includes(item)} onChange={() => toggle('condition', item)} />{t(item)}</label>)}</div></fieldset>
    <div className="market-field"><SearchSelect label={t('Статус')} value={value.status} onChange={value => update('status', value)} placeholder={t('Любой статус')} searchable={false} options={['В наличии', 'В пути', 'Под заказ'].map(item => ({ value: item, label: t(item) }))} /></div>
    {(['transmission', 'driveType', 'bodyType'] as const).map(key => <details key={key} className="market-filter-section"><summary>{t(specSelects.find(([id]) => id === key)![1])}{value[key] && <i />}</summary>{choice(key, specSelects.find(([id]) => id === key)![1])}</details>)}
    <details className="market-filter-section"><summary>{t('Все фильтры')}{['color', 'seats', 'batteryType', 'flowMode', 'featureTags', 'minPower', 'maxPower'].some(key => value[key as keyof Values]) && <i />}</summary>{specSelects.filter(([key]) => ['color', 'seats', 'batteryType', 'flowMode'].includes(key)).map(([key, label]) => <div key={key}>{choice(key, label)}</div>)}{choice('featureTags', 'Метки состояния и предложения')}{range('Мощность, л.с.', 'minPower', 'maxPower', 10000)}</details>
  </div>;
}
