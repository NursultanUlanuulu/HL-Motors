'use client';

import { useLocale } from '@/components/LocaleProvider';

import Link from 'next/link';
import { Header } from '@/components/Header';

export default function NotFound() {
  const { t } = useLocale();
  return <><Header active="catalog" /><main className="not-found"><p className="eyebrow">Motors</p><h1>{t("Страница")}<br /><em>{t("не найдена.")}</em></h1><p>{t("Возможно, автомобиль уже продан или ссылка устарела.")}</p><Link className="button button-gold" href="/catalog">{t("Вернуться в каталог")} <span>↗</span></Link></main></>;
}
