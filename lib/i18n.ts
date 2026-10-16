import { zh } from './zh';
import { en } from './en';
import { vehicleUi } from './vehicle-ui';
import { marketplaceUi } from './marketplace-ui';
import { pluralizeCars } from './cars';

export type Locale = 'ru' | 'en' | 'zh';
export const locales: Locale[] = ['ru', 'en', 'zh'];
export function parseLocale(value: string | null): Locale { return value === 'en' || value === 'zh' ? value : 'ru'; }
export type TranslationParams = Record<string, string | number>;
export const languageKey = 'hl-motors-language';

export function translate(text: string, locale: Locale, params: TranslationParams = {}) {
  const translated = locale === 'ru' ? text : marketplaceUi[text]?.[locale] ?? vehicleUi[text]?.[locale] ?? (locale === 'zh' ? zh[text] : en[text]) ?? text;
  return translated.replace(/\{(\w+)\}/g, (token, key: string) => params[key] === undefined ? token : String(params[key]));
}

export function carCount(count: number, locale: Locale) {
  return locale === 'zh' ? `${count} 辆车` : locale === 'en' ? `${count} ${count === 1 ? 'car' : 'cars'}` : `${count} ${pluralizeCars(count)}`;
}
