import { carTextFields, type Car, type CarText, type CarTextField } from './cars';
import { translate, type Locale } from './i18n';

export function translatedCarText(car: Car, field: CarTextField, locale: Locale): string {
  const other = locale === 'ru' ? 'zh' : 'ru';
  const value = car.translations?.[locale]?.[field]?.trim() || car.translations?.[other]?.[field]?.trim() || car[field] || '';
  if (locale === 'ru') return value;
  return translate(value, locale).replace(/\s*км(?=\s|$)/gu, ' 公里').replace(/\s*л\.с\./gu, ' 马力');
}

export function localizeCar(car: Car, locale: Locale): Car {
  return { ...car, ...Object.fromEntries(carTextFields.map(field => [field, translatedCarText(car, field, locale)])) };
}

export function brandLabel(brand: string, cars: Car[], locale: Locale) {
  const car = cars.find(item => item.brand === brand);
  return car ? translatedCarText(car, 'brand', locale) : brand;
}

export function updateCarText(car: Car, locale: Locale, field: CarTextField, value: string): Car {
  const legacy: CarText = Object.fromEntries(carTextFields.map(key => [key, car[key] ?? '']));
  const translations = { ru: legacy, ...car.translations };
  return { ...car, translations: { ...translations, [locale]: { ...translations[locale], [field]: value } } };
}

export function normalizeCarText(car: Car): Car {
  const fields = Object.fromEntries(carTextFields.map(field => {
    const ru = car.translations?.ru?.[field];
    const zh = car.translations?.zh?.[field];
    return [field, ru !== undefined || zh !== undefined ? ru?.trim() || zh?.trim() || '' : car[field] ?? ''];
  }));
  return { ...car, ...fields };
}
