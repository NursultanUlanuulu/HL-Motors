import type { Car } from './cars';
import { vehicleOptions } from './vehicle-dictionaries';
import { initialAdvancedFilters, matchesAdvanced } from './vehicle-filters';
import { canonicalBrand, carOption } from './vehicle-specs';

export const marketDefaults = { ...initialAdvancedFilters, brand: '', model: '', status: '', condition: '', sort: 'asc', page: '1' };
export type MarketFilters = typeof marketDefaults;
export function readMarketFilters(params: URLSearchParams): MarketFilters {
  const value = { ...marketDefaults };
  for (const key of Object.keys(value) as (keyof MarketFilters)[]) {
    const input = params.get(key);
    if (input !== null && input.length <= 500) value[key] = input;
  }
  value.sort = ['asc', 'desc', 'newest'].includes(value.sort) ? value.sort : 'asc';
  value.page = /^\d+$/.test(value.page) ? String(Math.max(1, Math.min(Number(value.page), 100000))) : '1';
  value.status = ['В наличии', 'В пути', 'Под заказ'].includes(value.status) ? value.status : '';
  value.condition = value.condition.split('|').filter(x => ['Новый', 'С пробегом'].includes(x)).join('|');
  for (const key of Object.keys(initialAdvancedFilters) as (keyof typeof initialAdvancedFilters)[]) {
    if (key.startsWith('min') || key.startsWith('max')) value[key] = /^\d{1,9}(\.\d{1,2})?$/.test(value[key]) ? value[key] : '';
    if (key in vehicleOptions) {
      const choices = vehicleOptions[key as keyof typeof vehicleOptions];
      value[key] = value[key].split('|').filter(id => choices.some(option => option.id === id)).slice(0, key === 'fuelType' ? choices.length : 1).join('|');
    }
  }
  return value;
}
export function marketQuery(value: MarketFilters): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(marketDefaults) as (keyof MarketFilters)[]) if (value[key] && value[key] !== marketDefaults[key]) params.set(key, value[key]);
  return params.toString();
}
export function filterMarketCars(cars: Car[], filters: MarketFilters): Car[] {
  return cars.filter(car => (!filters.brand || canonicalBrand(car.brand) === canonicalBrand(filters.brand))
    && (!filters.model || car.model === filters.model) && (!filters.status || car.status === filters.status)
    && (!filters.condition || filters.condition.split('|').includes(car.condition))
    && (!filters.fuelType || filters.fuelType.split('|').includes(carOption(car, 'fuelType')))
    && matchesAdvanced(car, { ...filters, fuelType: '' }))
    .sort((a, b) => filters.sort === 'desc' ? b.price - a.price : filters.sort === 'newest' ? b.year - a.year : a.price - b.price);
}
