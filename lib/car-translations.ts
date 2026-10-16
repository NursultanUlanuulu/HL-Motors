import { carTextFields, type Car, type CarText, type CarTextField } from './cars';
import { translate, type Locale } from './i18n';
import { carOption, canonicalBrand, dictionaryBrand, optionLabel } from './vehicle-specs';

export function translatedCarText(car: Car, field: CarTextField, locale: Locale): string {
  if (field === 'brand') {
    const brand = dictionaryBrand(car.brand, locale);
    if (brand) return brand;
  }
  const group = field === 'drive' ? 'driveType' : field === 'body' ? 'bodyType' : field === 'color' ? 'color' : field === 'transmission' ? 'transmission' : undefined;
  if (group) {
    const selected = carOption(car, group);
    if (selected) return optionLabel(group, selected, locale);
  }
  const number = field === 'mileage' ? car.specs?.mileageKm : field === 'power' ? car.specs?.powerHp : undefined;
  if (number !== undefined) return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(number)} ${field === 'mileage' ? (locale === 'zh' ? '公里' : locale === 'en' ? 'km' : 'км') : locale === 'zh' ? '马力' : locale === 'en' ? 'hp' : 'л.с.'}`;
  const value = car.translations?.[locale]?.[field]?.trim()
    || car.translations?.ru?.[field]?.trim() || car.translations?.en?.[field]?.trim()
    || car.translations?.zh?.[field]?.trim() || car[field] || '';
  if (locale === 'ru') return value;
  return translate(value, locale).replace(/\s*км(?=\s|$)/gu, locale === 'en' ? ' km' : ' 公里').replace(/\s*л\.с\./gu, locale === 'en' ? ' hp' : ' 马力');
}

export function localizeCar(car: Car, locale: Locale): Car {
  return { ...car, ...Object.fromEntries(carTextFields.map(field => [field, translatedCarText(car, field, locale)])) };
}

export function brandLabel(brand: string, cars: Car[], locale: Locale) {
  const car = cars.find(item => item.brand === brand);
  return dictionaryBrand(brand, locale) ?? (car ? translatedCarText(car, 'brand', locale) : brand);
}

export function modelLabel(model: string, cars: Car[], locale: Locale, brand = '') {
  const car = cars.find(item => item.model === model && (!brand || canonicalBrand(item.brand) === canonicalBrand(brand)));
  return car ? translatedCarText(car, 'model', locale) : model;
}

export function updateCarText(car: Car, locale: Locale, field: CarTextField, value: string): Car {
  const legacy: CarText = Object.fromEntries(carTextFields.map(key => [key, car[key] ?? '']));
  const translations = car.translations ? { ...car.translations } : { ru: legacy };
  // A translated fallback in the base field is not a Russian translation.
  // Only capture legacy text when this field has no language metadata yet.
  if (car.translations && !Object.values(car.translations).some(text => text?.[field] !== undefined) && car[field]) {
    translations.ru = { ...translations.ru, [field]: car[field] };
  }
  return { ...car, translations: { ...translations, [locale]: { ...translations[locale], [field]: value } } };
}

export function editableCarText(car: Car, locale: Locale, field: CarTextField): string {
  const explicit = car.translations?.[locale]?.[field];
  if (explicit !== undefined) return explicit;
  const hasTranslation = Object.values(car.translations ?? {}).some(text => text?.[field] !== undefined);
  return locale === 'ru' && !hasTranslation ? car[field] ?? '' : '';
}

export function normalizeCarText(car: Car): Car {
  const fields = Object.fromEntries(carTextFields.map(field => {
    const ru = car.translations?.ru?.[field];
    const en = car.translations?.en?.[field];
    const zh = car.translations?.zh?.[field];
    // The chosen brand remains a language-independent catalogue key.
    if (field === 'brand' && dictionaryBrand(car.brand, 'en')) return [field, car.brand];
    return [field, ru !== undefined || en !== undefined || zh !== undefined ? ru?.trim() || en?.trim() || zh?.trim() || '' : car[field] ?? ''];
  }));
  return { ...car, ...fields };
}
