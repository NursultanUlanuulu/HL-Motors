'use client';
import Link from 'next/link';
import { MarketFrame } from './MarketFrame';
import { useLocale } from './LocaleProvider';
import { useSiteData } from './SiteDataProvider';
import { telegramLink, whatsappLink } from '@/lib/site-data';

export function MarketInfo({ kind }: { kind: 'delivery' | 'about' | 'contacts' }) {
  const { t } = useLocale(); const { contacts } = useSiteData();
  const title = kind === 'delivery' ? 'Доставка и оплата' : kind === 'about' ? 'О компании' : 'Контакты';
  const steps = [
    ['Подбор', 'Находим автомобиль по вашим параметрам и бюджету.'],
    ['Проверка', 'Проводим осмотр, диагностику и проверяем документы.'],
    ['Доставка', 'Организуем безопасную перевозку и сопровождаем груз.'],
    ['Оформление', 'Таможня, лаборатория и документы — без лишних забот.'],
  ];
  return <MarketFrame><main className="market-main market-info"><nav className="market-breadcrumbs"><Link href="/catalog">{t('Каталог')}</Link><span>/</span><span>{t(title)}</span></nav><h1>{t(title)}</h1>
    <p className="market-info-lead">{t(kind === 'contacts' ? 'Расскажите, какой автомобиль ищете — найдём лучший вариант и рассчитаем поставку под ключ.' : 'Вы выбираете автомобиль. Всё остальное берём на себя — от проверки в Китае до выдачи в вашем городе.')}</p>
    {kind !== 'contacts' && <div className="market-info-grid">{steps.map(([label, text], index) => <section className="market-info-section" key={label}><b>0{index + 1}</b><h2>{t(label)}</h2><p>{t(text)}</p></section>)}</div>}
    {kind === 'delivery' && <section className="market-info-section" style={{ marginTop: 20 }}><h2>{t('Стоимость и оплата')}</h2><p>{t('Статус и состав цены зависят от страны доставки. Менеджер подготовит расчёт под ключ с учётом таможенного оформления, лаборатории и регистрации.')}</p><p>{t('Сроки доставки, порядок оплаты и итоговая стоимость согласовываются с менеджером до оформления заказа.')}</p></section>}
    <div className="market-info-contact"><a className="market-primary" href={whatsappLink(contacts)} target="_blank" rel="noreferrer">{t('Написать в WhatsApp')} ↗</a><a className="market-secondary" href={telegramLink(contacts)} target="_blank" rel="noreferrer">{t('Написать в Telegram')} ↗</a>{kind === 'contacts' && <a className="market-secondary" href={`mailto:${contacts.email}`}>{contacts.email}</a>}</div>
  </main></MarketFrame>;
}
