'use client';

import { useLocale } from '@/components/LocaleProvider';

import { CatalogClient } from '@/components/CatalogClient';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';



export function CatalogPage() {
  const { t } = useLocale();
  return <><Header active="catalog" /><main><section className="catalog-hero"><p className="eyebrow"><span className="section-number">01</span>  {t("Автомобили Motors")}</p><div className="catalog-heading"><h1>{t("Автомобили")}<br /><em>{t("на ваш маршрут.")}</em></h1><p>{t("В наличии, уже в пути или под заказ из Китая. Каждое предложение прошло проверку нашей команды.")}</p></div></section><CatalogClient /></main><Footer /></>;
}
