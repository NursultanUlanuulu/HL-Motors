'use client';
import Link from 'next/link';
import { useLocale } from './LocaleProvider';
import { useSiteData } from './SiteDataProvider';
export function Footer({ compact = false }: { compact?: boolean }) {
  const { t } = useLocale(); const { contacts } = useSiteData();
  return <footer className="market-footer"><span>© {new Date().getFullYear()} HL Motors</span><span>{t('Автомобили из Китая.')}</span><nav aria-label={t('Навигация в подвале')}><Link href="/delivery">{t('Доставка и оплата')}</Link><Link href="/contacts">{t('Контакты')}</Link>{!compact && <a href={'mailto:' + contacts.email}>{contacts.email}</a>}</nav></footer>;
}