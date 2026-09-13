'use client';

import { useLocale } from '@/components/LocaleProvider';

import Link from 'next/link';
import { useSiteData } from './SiteDataProvider';

export function AdminAnalytics() {
  const { locale, t } = useLocale();
  const { cars: items, loaded, error } = useSiteData();

  return <>
    {error && <p className="admin-media-error" role="alert">{t(error)}</p>}
    <section className="admin-stats" aria-label={t("Статистика каталога")}>
      <Stat label={t("Всего объявлений")} value={loaded ? items.length : '—'} accent="gold" note={t("В каталоге")} />
      <Stat label={t("В наличии")} value={loaded ? items.filter((car) => car.status === 'В наличии').length : '—'} accent="green" note={t("Готовы к продаже")} />
      <Stat label={t("В пути")} value={loaded ? items.filter((car) => car.status === 'В пути').length : '—'} accent="blue" note={t("Ожидаются")} />
      <Stat label={t("Под заказ")} value={loaded ? items.filter((car) => car.status === 'Под заказ').length : '—'} accent="purple" note={t("Доступны для заказа")} />
    </section>
    <section className="admin-panel admin-section-panel">
      <div className="admin-panel-top"><div><h2>{t("Посещения и переходы")}</h2><p>{t("Активность посетителей сайта и интерес к автомобилям.")}</p></div></div>
      <div className="admin-section-empty"><span aria-hidden="true">◫</span><h3>{t("Статистика посещений пока недоступна")}</h3><p>{t("После подключения аналитики здесь появятся просмотры автомобилей и переходы в WhatsApp и Telegram.")}</p></div>
      <Link className="admin-section-link" href="/admin/contacts">{t("Перейти к обращениям →")}</Link>
    </section>
  </>;
}

function Stat({ label, value, accent, note }: { label: string; value: number | string; accent: string; note: string }) {
  const { locale, t } = useLocale();
  return <article className={`admin-stat ${accent}`}><span>{t(label)}</span><strong>{value}</strong><small>{t(note)}</small><i aria-hidden="true" /></article>;
}
