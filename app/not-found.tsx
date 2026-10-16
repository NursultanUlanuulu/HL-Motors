'use client';

import { useLocale } from '@/components/LocaleProvider';

import Link from 'next/link';
import { MarketFrame } from '@/components/MarketFrame';

export default function NotFound() {
  const { t } = useLocale();
  return <MarketFrame><main className="market-main market-empty"><h1>{t('Страница')} {t('не найдена.')}</h1><p>{t('Возможно, автомобиль уже продан или ссылка устарела.')}</p><Link className="market-primary" href="/catalog">{t('Вернуться в каталог')} ↗</Link></main></MarketFrame>;
}
