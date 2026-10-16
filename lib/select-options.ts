import type { Car } from './cars';
import type { Locale } from './i18n';
import { vehicleBrands } from './vehicle-dictionaries';
import { canonicalBrand, dictionaryBrand } from './vehicle-specs';
import { translatedCarText } from './car-translations';

export type SelectOption = { value: string; label: string; keywords?: string; detail?: string; count?: number };
const russianBrands: Record<string, string> = {
  'Mercedes Benz': 'мерседес мерседесбенц', BMW: 'бмв', Toyota: 'тойота тоёта', Lexus: 'лексус', Audi: 'ауди',
  Volkswagen: 'фольксваген фольцваген', Porsche: 'порше', BYD: 'бид биайди', Zeekr: 'зикр зикер',
  'Li car': 'лисян лиавто лиидеал', 'AITO AITO': 'айто аито', 'Geely car': 'джили', Chery: 'чери',
  Changan: 'чанган', Haval: 'хавал хавейл', Hongqi: 'хончи хунци', Exeed: 'эксид', Tank: 'танк',
  Tesla: 'тесла', Hyundai: 'хендай хёндай', Kia: 'киа', Nissan: 'ниссан', Honda: 'хонда', Mazda: 'мазда',
  Buick: 'бьюик', 'Dongfeng Yi Pai': 'донгфенг дунфэн ипай', Ford: 'форд', Volvo: 'вольво',
};
export function normalizeOptionSearch(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]/gu, '');
}
export function searchOptions(options: SelectOption[], query: string): SelectOption[] {
  const tokens = query.trim().split(/\s+/).map(normalizeOptionSearch).filter(Boolean);
  return tokens.length ? options.filter(option => {
    const text = normalizeOptionSearch(`${option.label} ${option.value} ${option.keywords ?? ''}`);
    return tokens.every(token => text.includes(token));
  }) : options;
}
export function brandSelectOptions(cars: Car[], locale: Locale): SelectOption[] {
  const names = [...new Set([...vehicleBrands.filter(brand => brand.selectable).map(brand => brand.name), ...cars.map(car => canonicalBrand(car.brand))])];
  return names.map(value => ({ value, label: dictionaryBrand(value, locale) ?? value,
    detail: locale === 'zh' ? dictionaryBrand(value, 'en') : dictionaryBrand(value, 'zh'),
    keywords: `${dictionaryBrand(value, 'en') ?? ''} ${dictionaryBrand(value, 'zh') ?? ''} ${russianBrands[value] ?? ''}`,
    count: cars.filter(car => canonicalBrand(car.brand) === value).length,
  })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, locale));
}
export function modelSelectOptions(cars: Car[], brand: string, locale: Locale): SelectOption[] {
  const matching = cars.filter(car => !brand || canonicalBrand(car.brand) === canonicalBrand(brand));
  return [...new Set(matching.map(car => car.model))].map(value => {
    const models = matching.filter(car => car.model === value);
    return { value, label: translatedCarText(models[0], 'model', locale),
      keywords: models.flatMap(car => [car.model, ...Object.values(car.translations ?? {}).map(text => text.model ?? '')]).join(' '),
      detail: [...new Set(models.map(car => dictionaryBrand(car.brand, locale) ?? car.brand))].join(', '), count: models.length };
  }).sort((a, b) => a.label.localeCompare(b.label, locale));
}
