import type { Car } from './cars';
import { canonicalBrand } from './vehicle-specs';

export type AdminFilters = { query: string; status: string; brand: string; year: string; minPrice: string; maxPrice: string; condition: string; sort: string };
export const initialAdminFilters: AdminFilters = { query: '', status: '', brand: '', year: '', minPrice: '', maxPrice: '', condition: '', sort: 'default' };

export function filterAdminCars(cars: Car[], filters: AdminFilters) {
  const query = filters.query.trim().toLowerCase();
  const result = cars.filter(car =>
    (!filters.status || car.status === filters.status)
    && (!filters.brand || canonicalBrand(car.brand) === canonicalBrand(filters.brand))
    && (!filters.year || String(car.year) === filters.year)
    && (!filters.condition || car.condition === filters.condition)
    && (!filters.minPrice || car.price >= Number(filters.minPrice))
    && (!filters.maxPrice || car.price <= Number(filters.maxPrice))
    && `${car.brand} ${car.model} ${car.id} ${car.carCode ?? ''} ${car.vin ?? ''} ${Object.values(car.translations ?? {}).flatMap(text => Object.values(text)).join(' ')}`.toLowerCase().includes(query));
  if (filters.sort === 'price-asc') result.sort((a, b) => a.price - b.price);
  if (filters.sort === 'price-desc') result.sort((a, b) => b.price - a.price);
  if (filters.sort === 'year-desc') result.sort((a, b) => b.year - a.year);
  if (filters.sort === 'year-asc') result.sort((a, b) => a.year - b.year);
  if (filters.sort === 'brand') result.sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`));
  return result;
}
