'use client';

import { useLocale } from '@/components/LocaleProvider';

import Link from 'next/link';
import { useSiteData } from './SiteDataProvider';
import { Brand } from './Brand';
import { telegramLink, whatsappLink } from '@/lib/site-data';

export function Footer({ compact = false }: { compact?: boolean }) {
  const { t } = useLocale();
  const { contacts } = useSiteData();
  return (
    <footer className={`site-footer${compact ? ' site-footer-compact' : ''}`}>
      <div className="site-footer-main">
        <div className="site-footer-identity">
          <Brand />
          <p>{t('Автомобили из Китая.')}<br />{t('С заботой о каждом километре.')}</p>
          <span className="site-footer-location"><span aria-hidden="true">↗</span>{t('Бишкек · Кыргызстан')}</span>
        </div>
        <nav className="site-footer-nav" aria-label={t('Навигация в подвале')}>
          <h2>{t('Навигация')}</h2>
          <Link href="/catalog">{t('Автомобили')}</Link>
          <Link href="/#process">{t('Как мы работаем')}</Link>
          <Link href="/#about">{t('О компании')}</Link>
          <Link href="/#contacts">{t('Контакты')}</Link>
        </nav>
        <div className="site-footer-contacts">
          <h2>{t('Связаться с нами')}</h2>
          <a className="site-footer-email" href={`mailto:${contacts.email}`}>{contacts.email}<span aria-hidden="true">↗</span></a>
          <div className="site-footer-socials">
            <a href={whatsappLink(contacts)} target="_blank" rel="noreferrer">WhatsApp<span aria-hidden="true">↗</span></a>
            <a href={telegramLink(contacts)} target="_blank" rel="noreferrer">Telegram<span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </div>
      <div className="site-footer-bottom">
        <span>© {new Date().getFullYear()} Motors</span>
        <span className="site-footer-destinations">{t('Россия · Беларусь · Казахстан')}</span>
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>{t('Наверх ↑')}</button>
      </div>
    </footer>
  );
}
