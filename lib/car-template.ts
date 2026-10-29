import type { Car, CarText } from './cars';
import type { VehicleSpecs } from './vehicle-specs';

const sharedText = ['brand', 'model', 'trim', 'power', 'drive', 'body', 'transmission', 'engine', 'remark', 'highlights'] as const;
const sharedSpecs = ['fuelType', 'transmission', 'driveType', 'bodyType', 'seats', 'batteryType', 'flowMode', 'displacement', 'powerHp', 'acceleration', 'fuelConsumption', 'batteryCapacity', 'range'] as const;

/** Copy only model information, retaining this draft's identity and individual data. */
export function applyCarTemplate(draft: Car, source: Car): Car {
  const text = Object.fromEntries(sharedText.map(key => [key, source[key] ?? ''])) as CarText;
  const translations = structuredClone(draft.translations ?? {});
  for (const locale of ['ru', 'en', 'zh'] as const) {
    const translated = { ...translations[locale] };
    for (const key of sharedText) {
      delete translated[key];
      if (source.translations?.[locale]?.[key] !== undefined) translated[key] = source.translations[locale]![key];
    }
    translations[locale] = translated;
  }
  const specs: VehicleSpecs = { ...draft.specs };
  for (const key of sharedSpecs) delete specs[key];
  for (const key of sharedSpecs) {
    if (source.specs?.[key] !== undefined) Object.assign(specs, { [key]: source.specs[key] });
  }
  return { ...draft, ...text, translations, specs };
}
