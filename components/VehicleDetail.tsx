'use client';

import { useLocale } from '@/components/LocaleProvider';

import { useEffect } from 'react';
import Link from 'next/link';
import { Footer } from './Footer';
import { Header } from './Header';
import { VehicleGallery } from './VehicleGallery';
import { useSiteData } from './SiteDataProvider';
import { localizeCar } from '@/lib/car-translations';
import { formatPrice } from '@/lib/cars';
import { whatsappLink, telegramLink } from '@/lib/site-data';

export function VehicleDetail({ id }: { id: string }) {
  const { locale, t } = useLocale();
  const { cars, contacts, loaded, error } = useSiteData();
  const originalCar = cars.find(item => item.id === id);
  const car = originalCar ? localizeCar(originalCar, locale) : undefined;
  useEffect(() => {
    if (loaded) document.title = car ? `${car.brand} ${car.model} — Motors` : t('Автомобиль недоступен — Motors');
  }, [car?.brand, car?.model, loaded, locale]);
  if (!loaded) return <><Header active="catalog" /><main className="catalog-page-content" role="status">{t(error || 'Загружаем автомобиль…')}</main><Footer compact /></>;
  if (!car) return <><Header active="catalog" /><main className="catalog-page-content"><h1>{t("Автомобиль недоступен")}</h1><p>{t("Объявление снято с публикации или отсутствует в этом браузере.")}</p><Link className="text-link" href="/catalog">{t("Вернуться в каталог →")}</Link></main><Footer compact /></>;
  const gallery = car.gallery?.length ? car.gallery : car.image ? [car.image] : [];
  const whatsappText = t('Здравствуйте! Интересует {name}. Номер объявления: {id}. Год: {year}. Цена: ${price}. Статус: {status}.', { name: `${car.brand} ${car.model}`, id: car.id, year: car.year, price: formatPrice(car.price), status: t(car.status) });
  const whatsappUrl = whatsappLink(contacts, whatsappText);
  return <><Header active="catalog" /><main><section className="vehicle-top"><div className="breadcrumbs"><Link href="/">{t("Главная")}</Link><span>·</span><Link href="/catalog">{t("Автомобили")}</Link><span>·</span><b>{car.brand} {car.model}</b></div><div className="vehicle-heading"><div><p className="eyebrow"><span className="status-dot"></span>{t(car.status)}</p><h1>{car.brand} <em>{car.model}</em></h1><p>{car.trim} · {t(car.condition)}</p></div><Link className="back-link" href="/catalog">{t("← Все автомобили")}</Link></div></section><VehicleGallery key={`${car.id}:${gallery.join('|')}:${car.video ?? ''}`} gallery={gallery} name={`${car.brand} ${car.model}`} videoSource={car.video} /><section className="vehicle-detail-layout"><div className="vehicle-information"><div className="detail-intro"><p className="eyebrow"><span className="section-number">01</span>  {t("Об автомобиле")}</p><h2>{t("Всё, что важно")}<br />{t("знать")} <em>{t("до покупки.")}</em></h2><p>{t("Автомобиль прошёл визуальный осмотр и первичную техническую проверку. Полный фото- и видеоотчёт по запросу менеджеру.")}</p></div><div className="spec-section"><h3>{t("Основные характеристики")}</h3><dl className="spec-grid"><dt>{t("Год выпуска")}</dt><dd>{car.year}</dd><dt>{t("Пробег")}</dt><dd>{car.mileage}</dd><dt>{t("Состояние")}</dt><dd>{t(car.condition)}</dd><dt>{t("Тип кузова")}</dt><dd>{t(car.body || 'Не указано')}</dd><dt>{t("Двигатель")}</dt><dd>{t(car.engine || 'Не указано')}</dd><dt>{t("Мощность")}</dt><dd>{car.power}</dd><dt>{t("Коробка передач")}</dt><dd>{t(car.transmission || 'Не указано')}</dd><dt>{t("Привод")}</dt><dd>{car.drive}</dd><dt>{t("Цвет кузова")}</dt><dd>{t(car.color || 'Не указано')}</dd><dt>VIN</dt><dd>{t(car.vin || 'По запросу')}</dd><dt>{t("Тип оформления")}</dt><dd>{t(car.customsType || 'Не указано')}</dd></dl></div><div className="customs-block"><span>✦</span><div><h3>{t("Таможенная информация")}</h3><p>{t("Статус и состав цены зависят от страны доставки. Менеджер подготовит расчёт под ключ с учётом таможенного оформления, лаборатории и регистрации.")}</p></div><a href={whatsappUrl} target="_blank" rel="noreferrer">{t("Уточнить условия ↗")}</a></div><div className="location-block"><p className="eyebrow"><span className="section-number">02</span>  {t("Местонахождение")}</p><h3>{car.city}</h3><p>{t("Текущий статус:")} <b>{t(car.status)}</b>{t(". Получите актуальные фото, видео и информацию о сроках поставки у менеджера.")}</p></div></div><aside className="purchase-card"><div className="purchase-price"><span>{t("Стоимость")}</span><strong>${formatPrice(car.price)}</strong><small>{t("Ориентировочная цена в USD")}</small></div><div className="purchase-status"><span className="status-dot"></span><div><b>{t(car.status)}</b><small>{car.city}</small></div></div><a className="button button-gold" href={whatsappUrl} target="_blank" rel="noreferrer">{t("Написать в WhatsApp")} <span>↗</span></a><a className="purchase-telegram" href={telegramLink(contacts)} target="_blank" rel="noreferrer">Telegram @{contacts.telegram} <span>↗</span></a><p>{t("Свяжитесь с менеджером — он отправит подробный отчёт, ответит на вопросы и зафиксирует условия.")}</p></aside></section><section className="detail-contact"><p className="eyebrow">{t("Motors · полная прозрачность")}</p><h2>{t("Остались вопросы")}<br />{t("по")} <em>{t("автомобилю?")}</em></h2><a className="text-link" href={whatsappUrl} target="_blank" rel="noreferrer">{t("Получить консультацию")} <span>↗</span></a></section><div className="mobile-contact"><span>${formatPrice(car.price)}</span><a className="button button-gold" href={whatsappUrl} target="_blank" rel="noreferrer">{t("Написать")} <span>↗</span></a></div></main><Footer compact /></>;
}
