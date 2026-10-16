import type { Car } from './cars';
import { carNumeric, carOption, dictionaryBrand, specSelects } from './vehicle-specs';

export const initialAdvancedFilters = {
  query: '', fuelType: '', transmission: '', driveType: '', bodyType: '', color: '', seats: '', batteryType: '', flowMode: '', featureTags: '',
  minPrice: '', maxPrice: '', minYear: '', maxYear: '', minMileage: '', maxMileage: '', minPower: '', maxPower: '',
};
export type AdvancedFilters = typeof initialAdvancedFilters;
function inRange(value: number | undefined, min: string, max: string): boolean {
  if (!min && !max) return true;
  if (value === undefined) return false;
  return (!min || value >= Number(min)) && (!max || value <= Number(max));
}
export function matchesAdvanced(car: Car, filters: AdvancedFilters): boolean {
  const query = filters.query.trim().toLowerCase();
  if (query && ![car.brand, dictionaryBrand(car.brand, 'zh'), dictionaryBrand(car.brand, 'en'), car.model, car.trim, car.title, car.id, car.carCode, ...Object.values(car.translations ?? {}).flatMap(text => Object.values(text))].join(' ').toLowerCase().includes(query)) return false;
  if (!specSelects.every(([key]) => !filters[key] || carOption(car, key) === filters[key])) return false;
  if (filters.featureTags && !car.featureTags?.includes(filters.featureTags)) return false;
  return inRange(car.price, filters.minPrice, filters.maxPrice)
    && inRange(car.year, filters.minYear, filters.maxYear)
    && inRange(carNumeric(car, 'mileageKm'), filters.minMileage, filters.maxMileage)
    && inRange(carNumeric(car, 'powerHp'), filters.minPower, filters.maxPower);
}
