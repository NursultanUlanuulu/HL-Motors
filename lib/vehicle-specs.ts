import { vehicleOptions, vehicleBrands } from './vehicle-dictionaries';
import type { Car } from './cars';
import type { Locale } from './i18n';

export type OptionGroup = keyof typeof vehicleOptions;
export type VehicleSpecs = Partial<Record<'fuelType' | 'transmission' | 'driveType' | 'bodyType' | 'color' | 'seats' | 'batteryType' | 'flowMode', string>> & {
  displacement?: number; mileageKm?: number; powerHp?: number; acceleration?: number;
  fuelConsumption?: number; batteryCapacity?: number; range?: number;
  registrationDate?: string; officialPrice?: number;
};
export const specSelects = [
  ['fuelType', 'Топливо и силовая установка'], ['transmission', 'Коробка передач'],
  ['driveType', 'Привод'], ['bodyType', 'Кузов и размерный класс'], ['color', 'Цвет кузова'],
  ['seats', 'Количество мест'], ['batteryType', 'Тип батареи'], ['flowMode', 'Наддув и впуск двигателя'],
] as const;
export const specNumbers = [
  ['displacement', 'Объём двигателя, л', 0, 20, 0.001],
  ['mileageKm', 'Пробег, км', 0, 10000000, 1], ['powerHp', 'Мощность, л.с.', 0, 10000, 0.1],
  ['acceleration', 'Разгон 0–100 км/ч, с', 0, 300, 0.01],
  ['fuelConsumption', 'Расход топлива, л/100 км', 0, 200, 0.01],
  ['batteryCapacity', 'Ёмкость батареи, кВт·ч', 0, 2000, 0.01],
  ['range', 'Запас хода, км', 0, 10000, 1],
  ['officialPrice', 'Цена производителя, CNY', 0, 100000000, 1],
] as const;
export function optionLabel(group: OptionGroup, id: string, locale: Locale): string {
  const option = vehicleOptions[group].find(item => item.id === id);
  return option?.[locale] ?? id;
}
export function optionId(group: OptionGroup, value: string): string | undefined {
  const query = value.trim().toLocaleLowerCase();
  return vehicleOptions[group].find(item => [item.id, item.ru, item.en, item.zh, ...item.sources].some(label => label.toLocaleLowerCase() === query))?.id;
}
const legacyAliases: Record<string, string> = {
  'Полный': 'Four-wheel drive', 'Передний': 'Precursor', 'Задний': 'Rear-wheel drive',
  'Одноступенчатая': 'Electric vehicle single speed gearbox', 'Автоматическая': 'Automatic',
  'Бензин': 'Gasoline', 'Электро': 'Pure electric', 'Гибрид': 'Hybrid (oil-electric)',
};
export function carOption(car: Car, group: typeof specSelects[number][0]): string {
  if (car.specs?.[group]) return car.specs[group]!;
  const legacy = group === 'driveType' ? car.drive : group === 'bodyType' ? car.body : group === 'fuelType' ? car.engine : group === 'transmission' ? car.transmission : group === 'color' ? car.color : '';
  return legacy ? optionId(group, legacyAliases[legacy] ?? legacy) ?? '' : '';
}
export function legacyOptionText(car: Car, group: typeof specSelects[number][0]): string {
  return group === 'driveType' ? car.drive : group === 'bodyType' ? car.body ?? '' : group === 'color' ? car.color ?? '' : group === 'transmission' ? car.transmission ?? '' : '';
}
export function carNumeric(car: Car, key: 'mileageKm' | 'powerHp'): number | undefined {
  if (car.specs?.[key] !== undefined) return car.specs[key];
  const text = key === 'mileageKm' ? car.mileage : car.power;
  if (key === 'mileageKm' && ['Новый', 'New', '新车'].includes(text)) return 0;
  // Only recognized numeric legacy values; unknown values never become zero.
  const match = text.trim().match(/^(\d[\d\s\u00a0]*(?:[.,]\d+)?)\s*(?:км|km|公里|л\.с\.|hp|马力)?$/iu);
  if (!match) return undefined;
  const compact = match[1].replace(/[\s\u00a0]/g, '');
  const number = Number(/^\d{1,3}(,\d{3})+$/.test(compact) ? compact.replace(/,/g, '') : compact.replace(',', '.'));
  return Number.isFinite(number) ? number : undefined;
}
export function validDate(value: unknown): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= 1
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function validSpecs(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, entry]) => {
    const select = specSelects.find(([field]) => field === key);
    if (select) return typeof entry === 'string' && vehicleOptions[select[0]].some(item => item.id === entry);
    const numeric = specNumbers.find(([field]) => field === key);
    if (numeric) return typeof entry === 'number' && Number.isFinite(entry) && entry >= numeric[2] && entry <= numeric[3] && (numeric[4] !== 1 || Number.isInteger(entry));
    return key === 'registrationDate' && validDate(entry);
  });
}
export function validFeatureTags(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.length <= vehicleOptions.featureTags.length
    && new Set(value).size === value.length && value.every(id => typeof id === 'string' && vehicleOptions.featureTags.some(item => item.id === id)));
}
const brandAliases: Record<string, string> = { 'Mercedes-Benz': 'Mercedes Benz', 'Li Auto': 'Li car', 'Aito': 'AITO AITO', 'Zeekr': 'Zeekr', 'Geely': 'Geely car' };
export function canonicalBrand(value: string): string { return brandAliases[value] ?? value; }
export const selectableBrands = [...new Set(vehicleBrands.filter(item => item.selectable).map(item => item.name))].sort((a, b) => a.localeCompare(b));
export function dictionaryBrand(value: string, locale: Locale): string | undefined {
  const brand = vehicleBrands.find(item => item.name === canonicalBrand(value));
  const display: Record<string, string> = { 'Li car': 'Li Auto', 'Mercedes Benz': 'Mercedes-Benz', 'AITO AITO': 'AITO', 'Geely car': 'Geely' };
  return brand ? locale === 'zh' ? brand.zh : display[brand.name] ?? brand.name : undefined;
}
