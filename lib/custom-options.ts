import { customsTypes } from './cars';
import { vehicleBrands, vehicleOptions } from './vehicle-dictionaries';
import { translate, type Locale } from './i18n';

export type DictionaryGroup = keyof typeof vehicleOptions | 'brand' | 'status' | 'customsType';
export type CustomOption = { category: DictionaryGroup; ru: string; en: string; zh: string };
export const customOptionsKey = 'firstseven-vehicle-options';
export const statuses = ['В наличии', 'В пути', 'Под заказ'] as const;
export const conditions = ['Новый', 'С пробегом'] as const;
const brandDisplay: Record<string, string> = { 'Li car': 'Li Auto', 'Mercedes Benz': 'Mercedes-Benz', 'AITO AITO': 'AITO', 'Geely car': 'Geely' };
export function brandDisplayName(name: string) {
  return Object.hasOwn(brandDisplay, name) ? brandDisplay[name] : name;
}
export function isDictionaryGroup(value: unknown): value is DictionaryGroup {
  return typeof value === 'string' && (Object.hasOwn(vehicleOptions, value) || ['brand', 'status', 'customsType'].includes(value));
}
export function isCustomValue(value: unknown): value is `custom:${string}` {
  return typeof value === 'string' && value.startsWith('custom:') && validName(value.slice(7));
}
function validName(text: string) {
  return !!text && text === text.trim() && text.length <= 80 && !/[|\p{Cc}]/u.test(text);
}
export function parseOption(value: unknown): CustomOption {
  if (!value || typeof value !== 'object') throw new Error('Проверьте название варианта.');
  const row = value as Record<string, unknown>;
  if (!isDictionaryGroup(row.category) || typeof row.ru !== 'string' || !validName(row.ru)
    || ![row.en, row.zh].every(s => typeof s === 'string' && (!s || validName(s)))) throw new Error('Проверьте название варианта.');
  return { category: row.category, ru: row.ru, en: row.en as string, zh: row.zh as string };
}
export function customValue(entry: CustomOption) {
  return entry.category === 'brand' ? entry.ru : 'custom:' + entry.ru;
}
export function customLabel(entries: CustomOption[], group: DictionaryGroup, value: string, locale: Locale) {
  const entry = entries.find(row => row.category === group && customValue(row) === value);
  return entry ? entry[locale] || entry.ru : isCustomValue(value) ? value.slice(7) : translate(value, locale);
}
export function optionsFor(entries: CustomOption[], group: keyof typeof vehicleOptions) {
  return [...vehicleOptions[group], ...entries.filter(entry => entry.category === group).map(entry => ({
    ...entry, id: customValue(entry), en: entry.en || entry.ru, zh: entry.zh || entry.ru, sources: [] as string[],
  }))];
}
export function fixedChoices(group: 'status' | 'condition' | 'customsType') {
  return group === 'status' ? statuses : group === 'condition' ? conditions : customsTypes;
}
export function existingValue(entries: CustomOption[], group: DictionaryGroup, name: string): string | undefined {
  const normalized = name.trim().toLowerCase();
  const matches = (...labels: string[]) => labels.some(label => label.toLowerCase() === normalized);
  const existing = entries.find(row => row.category === group && matches(row.ru, row.en, row.zh));
  if (existing) return customValue(existing);
  if (group === 'brand') return vehicleBrands.find(row => row.selectable && matches(row.name, brandDisplayName(row.name), row.zh))?.name;
  if (group === 'status' || group === 'condition' || group === 'customsType') return fixedChoices(group).find(value => matches(value, translate(value, 'en'), translate(value, 'zh')));
  return vehicleOptions[group].find(row => matches(row.ru, row.en, row.zh, ...row.sources))?.id;
}
export function readLocalOptions(): CustomOption[] {
  const value: unknown = JSON.parse(localStorage.getItem(customOptionsKey) || '[]');
  if (!Array.isArray(value)) throw new Error('Не удалось прочитать справочник.');
  return value.map(parseOption);
}
