import { zh } from './zh';
import { pluralizeCars } from './cars';

export type Locale = 'ru' | 'zh';
export type TranslationParams = Record<string, string | number>;
export const languageKey = 'hl-motors-language';

export function translate(text: string, locale: Locale, params: TranslationParams = {}) {
  const translated = locale === 'zh' ? zh[text] ?? text : text;
  return translated.replace(/\{(\w+)\}/g, (token, key: string) => params[key] === undefined ? token : String(params[key]));
}

export function carCount(count: number, locale: Locale) {
  return locale === 'zh' ? `${count} 辆车` : `${count} ${pluralizeCars(count)}`;
}
