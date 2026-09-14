import { cars as seedCars, carTextFields, customsTypes, type Car } from './cars';

export const carsKey = 'hl-motors-admin-cars';
export const contactsKey = 'hl-motors-contacts';
export type Contacts = { whatsapp: string; telegram: string; email: string };
export const defaultContacts: Contacts = { whatsapp: '996502102270', telegram: 'nur6ultan', email: 'hello@hlmotors.com' };

export function isCar(value: unknown): value is Car {
  if (!value || typeof value !== 'object') return false;
  const car = value as Record<string, unknown>;
  return ['id', 'brand', 'model', 'trim', 'mileage', 'city', 'power', 'drive', 'image'].every(key => typeof car[key] === 'string')
    && !!car.id && !!car.brand && !!car.model
    && typeof car.price === 'number' && Number.isFinite(car.price) && car.price > 0
    && typeof car.year === 'number' && Number.isInteger(car.year) && car.year >= 2000 && car.year <= 2035
    && ['В наличии', 'В пути', 'Под заказ'].includes(String(car.status))
    && ['Новый', 'С пробегом'].includes(String(car.condition))
    && (car.customsType === undefined || customsTypes.some(type => type === car.customsType))
    && validTranslations(car.translations)
    && ['vin', 'body', 'color', 'transmission', 'engine', 'video'].every(key => car[key] === undefined || typeof car[key] === 'string')
    && (car.gallery === undefined || (Array.isArray(car.gallery) && car.gallery.every(source => typeof source === 'string')));
}

function validTranslations(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([locale, fields]) => ['ru', 'zh'].includes(locale)
    && fields && typeof fields === 'object' && !Array.isArray(fields)
    && Object.entries(fields).every(([key, text]) => carTextFields.some(field => field === key) && typeof text === 'string'));
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

export function normalizeContacts(value: Contacts): Contacts {
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

export function writeContacts(value: Contacts): Contacts {
  const contacts = normalizeContacts(value);
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
