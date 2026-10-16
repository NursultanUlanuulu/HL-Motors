'use client';
import { vehicleOptions } from '@/lib/vehicle-dictionaries';
import { specSelects } from '@/lib/vehicle-specs';
import type { AdvancedFilters as Values } from '@/lib/vehicle-filters';
import { useLocale } from './LocaleProvider';

export function AdvancedFilters({ value, onChange }: { value: Values; onChange: (key: keyof Values, value: string) => void }) {
  const { locale, t } = useLocale();
  return <div className="advanced-filter-fields">
    <label>{t('Поиск модели или комплектации')}<input type="search" value={value.query} onChange={event => onChange('query', event.target.value)} /></label>
    {[...specSelects, ['featureTags', 'Метки состояния и предложения'] as const].map(([key, label]) => <label key={key}>{t(label)}<select value={value[key]} onChange={event => onChange(key, event.target.value)}><option value="">{t('Все')}</option>{vehicleOptions[key].map(option => <option key={option.id} value={option.id}>{option[locale]}</option>)}</select></label>)}
    {([
      ['minPrice', 'Цена от, USD', 0, 100000000], ['maxPrice', 'Цена до, USD', 0, 100000000],
      ['minYear', 'Год от', 2000, 2035], ['maxYear', 'Год до', 2000, 2035],
      ['minMileage', 'Пробег от, км', 0, 10000000], ['maxMileage', 'Пробег до, км', 0, 10000000],
      ['minPower', 'Мощность от, л.с.', 0, 10000], ['maxPower', 'Мощность до, л.с.', 0, 10000],
    ] as const).map(([key, label, min, max]) => <label key={key}>{t(label)}<input type="number" min={min} max={max} value={value[key]} onChange={event => onChange(key, event.target.value)} /></label>)}
  </div>;
}
