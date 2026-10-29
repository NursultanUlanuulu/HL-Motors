import type { Metadata } from 'next';
import type { Car } from './cars';
import { localizeCar } from './car-translations';

export const siteUrl = 'https://firstseven-auto.com';
export const siteName = 'firstseven avto';
export function pageMetadata(path: string, title: string, description: string, image = '/firstseven-avto-logo.png'): Metadata {
  const url = siteUrl + path;
  return {
    title, description, alternates: { canonical: url },
    openGraph: { type: 'website', url, title, description, siteName, locale: 'ru_RU', images: [{ url: image, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
export function vehicleSeo(source: Car) {
  const car = localizeCar(source, 'ru');
  const name = `${car.brand} ${car.model}`;
  const title = `${car.metaTitle || `${name} ${car.year} — купить автомобиль`} — ${siteName}`;
  const mileage = car.mileage && car.mileage !== 'Новый' ? ` Пробег: ${car.mileage}.` : '';
  const description = car.metaDescription || `${name}, ${car.year} год. Ориентировочная цена $${car.price.toLocaleString('en-US')}. ${car.condition}.${mileage} ${car.status}. Фото, осмотр и доставка. ${siteName}.`;
  return { car, name, title, description, path: `/catalog/${encodeURIComponent(car.id)}` };
}
export function jsonLd(value: unknown) { return JSON.stringify(value).replace(/</g, '\\u003c'); }

export function vehicleStructuredData(source: Car) {
  const { car, name, description, path } = vehicleSeo(source);
  return {
    '@context': 'https://schema.org', '@type': 'Car', name, description,
    url: siteUrl + path, sku: car.id, brand: { '@type': 'Brand', name: car.brand },
    model: car.model, vehicleModelDate: String(car.year),
    image: car.gallery?.length ? car.gallery : car.image ? [car.image] : undefined,
    itemCondition: `https://schema.org/${car.condition === 'Новый' ? 'NewCondition' : 'UsedCondition'}`,
    offers: { '@type': 'Offer', url: siteUrl + path, price: car.price, priceCurrency: 'USD',
      availability: `https://schema.org/${car.status === 'В наличии' ? 'InStock' : 'PreOrder'}`,
      seller: { '@type': 'Organization', name: siteName, url: siteUrl } },
  };
}

export function catalogMetadata(path: '/' | '/catalog', params: Record<string, string | string[] | undefined>): Metadata {
  const rawPage = typeof params.page === 'string' ? Number(params.page) : 1;
  const page = Number.isSafeInteger(rawPage) && rawPage > 1 ? rawPage : 1;
  const suffix = page > 1 ? ` — страница ${page}` : '';
  const title = path === '/' ? `Автомобили из Китая в Бишкеке${suffix} — ${siteName}` : `Каталог автомобилей из Китая${suffix} — ${siteName}`;
  const filtered = Object.entries(params).some(([key, value]) => !['page', 'sort', 'back', 'utm_source', 'utm_medium', 'utm_campaign'].includes(key) && Boolean(value));
  return { ...pageMetadata(path + (page > 1 ? `?page=${page}` : ''), title,
    'Автомобили из Китая в наличии и под заказ. Подбор, фото- и видеоосмотр, договор и доставка. Офис firstseven avto в Бишкеке, ул. Исакеева, 32/2.'),
    ...(filtered ? { robots: { index: false, follow: true } } : {}) };
}
