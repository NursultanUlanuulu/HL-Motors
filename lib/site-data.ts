import { cars as seedCars, carFields, carTextFields, carTextLimits, carPriceMin, carPriceMax, customsTypes, type Car, type CarTextField } from './cars';

export const carsKey = 'hl-motors-admin-cars';
export const contactsKey = 'hl-motors-contacts';
export type Contacts = { whatsapp: string; telegram: string; email: string };
export const defaultContacts: Contacts = { whatsapp: '996502102270', telegram: 'nur6ultan', email: 'hello@hlmotors.com' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function boundedText(value: unknown, limit: number): value is string {
  return typeof value === 'string' && Array.from(value).length <= limit;
}

export function isCar(value: unknown): value is Car {
  if (!isRecord(value)) return false;
  const car = value;
  return ['id', 'brand', 'model', 'trim', 'mileage', 'city', 'power', 'drive', 'image'].every(key => typeof car[key] === 'string')
    && Object.keys(car).every(key => carFields.some(field => field === key))
    && typeof car.id === 'string' && /^[\w-]{1,100}$/.test(car.id)
    && typeof car.brand === 'string' && !!car.brand.trim() && typeof car.model === 'string' && !!car.model.trim()
    && carTextFields.every(field => car[field] === undefined || boundedText(car[field], carTextLimits[field]))
    && typeof car.price === 'number' && Number.isSafeInteger(car.price) && car.price >= carPriceMin && car.price <= carPriceMax
    && typeof car.year === 'number' && Number.isInteger(car.year) && car.year >= 2000 && car.year <= 2035
    && typeof car.status === 'string' && ['В наличии', 'В пути', 'Под заказ'].includes(car.status)
    && typeof car.condition === 'string' && ['Новый', 'С пробегом'].includes(car.condition)
    && (car.version === undefined || (typeof car.version === 'number' && Number.isSafeInteger(car.version) && car.version >= 1))
    && (car.customsType === undefined || customsTypes.some(type => type === car.customsType))
    && validTranslations(car.translations)
    && (car.vin === undefined || boundedText(car.vin, 64))
    && boundedText(car.image, 4096) && (car.video === undefined || boundedText(car.video, 4096))
    && (car.gallery === undefined || (Array.isArray(car.gallery) && car.gallery.length <= 100 && car.gallery.every(source => boundedText(source, 4096))));
}

function validTranslations(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([locale, fields]) => ['ru', 'zh'].includes(locale)
    && isRecord(fields)
    && Object.entries(fields).every(([key, text]) => carTextFields.some(field => field === key) && boundedText(text, carTextLimits[key as CarTextField])));
}

// A read boundary must never spread stored JSON into a public response. Legacy
// extra fields are omitted; malformed known fields make only this record unusable.
export function publicCar(value: unknown): Car | null {
  if (!isRecord(value)) return null;
  const projected: Record<string, unknown> = {};
  for (const key of carFields) if (Object.hasOwn(value, key)) projected[key] = value[key];
  if (isRecord(projected.translations)) {
    const translations: Record<string, unknown> = {};
    for (const locale of ['ru', 'zh']) {
      const fields = projected.translations[locale];
      if (fields === undefined) continue;
      translations[locale] = isRecord(fields)
        ? Object.fromEntries(carTextFields.filter(field => Object.hasOwn(fields, field)).map(field => [field, fields[field]]))
        : fields;
    }
    projected.translations = translations;
  }
  return isCar(projected) ? projected : null;
}

// All browser persistence lives here so it can later be replaced by an API.
export function readCars(): Car[] {
  const saved = localStorage.getItem(carsKey);
  if (saved === null) return seedCars;
  const data: unknown = JSON.parse(saved);
  if (!Array.isArray(data) || !data.every(isCar) || new Set(data.map(car => car.id)).size !== data.length) {
    throw new Error('Не удалось прочитать каталог. Сохранённые данные повреждены.');
  }
  return data;
}

export function writeCar(car: Car, previous?: Car): Car[] {
  if (!isCar(car)) throw new Error('Проверьте данные автомобиля.');
  const current = readCars();
  const existing = current.find(item => item.id === car.id);
  if (previous && JSON.stringify(existing) !== JSON.stringify(previous)) {
    throw new Error('Это объявление изменилось в другой вкладке. Закройте редактор и откройте его снова.');
  }
  if (!previous && existing) throw new Error('Объявление с этим номером уже существует.');
  const next = existing ? current.map(item => item.id === car.id ? car : item) : [car, ...current];
  localStorage.setItem(carsKey, JSON.stringify(next));
  return next;
}

export function deleteCar(car: Car): Car[] {
  const current = readCars();
  const existing = current.find(item => item.id === car.id);
  if (existing && JSON.stringify(existing) !== JSON.stringify(car)) throw new Error('Объявление изменилось в другой вкладке. Повторите действие с актуальными данными.');
  const next = current.filter(item => item.id !== car.id);
  localStorage.setItem(carsKey, JSON.stringify(next));
  return next;
}

export function normalizeContacts(value: unknown): Contacts {
  if (!isRecord(value) || Object.keys(value).some(key => !['whatsapp', 'telegram', 'email'].includes(key))
    || !boundedText(value.whatsapp, 100) || !boundedText(value.telegram, 100) || !boundedText(value.email, 254)) {
    throw new Error('Проверьте контакты.');
  }
  const whatsapp = value.whatsapp.trim().replace(/^https:\/\/wa\.me\//i, '').replace(/[\s()+-]/g, '');
  const telegram = value.telegram.trim().replace(/^https:\/\/t\.me\//i, '').replace(/^@/, '').replace(/\/$/, '');
  const email = value.email.trim();
  if (!/^\d{7,15}$/.test(whatsapp)) throw new Error('Введите номер WhatsApp с кодом страны, например +996 502 102 270.');
  if (!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(telegram)) throw new Error('Введите имя Telegram (5–32 символа), например @nur6ultan.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Введите корректный email.');
  return { whatsapp, telegram, email };
}

export function readContacts(): Contacts {
  const saved = localStorage.getItem(contactsKey);
  if (saved === null) return defaultContacts;
  return normalizeContacts(JSON.parse(saved) as Contacts);
}

export function writeContacts(value: Contacts, previous: Contacts): Contacts {
  const contacts = normalizeContacts(value);
  const original = normalizeContacts(previous);
  if (JSON.stringify(readContacts()) !== JSON.stringify(original)) throw new Error('Контакты изменились. Обновите страницу и повторите.');
  localStorage.setItem(contactsKey, JSON.stringify(contacts));
  return contacts;
}

export const whatsappLink = (contacts: Contacts, text?: string) => `https://wa.me/${contacts.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const telegramLink = (contacts: Contacts) => `https://t.me/${contacts.telegram}`;

export function catalogOptions(cars: Car[]) {
  return {
    brands: [...new Set(cars.map(car => car.brand))].sort((a, b) => a.localeCompare(b)),
    years: [...new Set(cars.map(car => car.year))].sort((a, b) => b - a),
  };
}
