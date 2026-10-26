'use client';
import Link from 'next/link';
import { Brand } from './Brand';
import { useLocale } from './LocaleProvider';
import { useSiteData } from './SiteDataProvider';
import { ManagerContacts } from './ManagerContacts';
import { companyContent, officeMapUrl } from '@/lib/company-content';
import { telegramLink, whatsappLink } from '@/lib/site-data';

export function Footer({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useLocale(); const { contacts } = useSiteData();
  const c = (key: keyof typeof companyContent) => companyContent[key][locale];
  return <footer className={'market-footer company-footer' + (compact ? ' compact' : '')}>
    <div className="company-footer-grid">
      <div className="company-footer-brand"><Brand /><p>{c('tagline')}</p><small>{c('since')}</small></div>
      <div><h2>{c('navigation')}</h2><nav aria-label={t('Навигация в подвале')}>{[['/catalog', 'Каталог'], ['/delivery', 'Доставка и оплата'], ['/about', 'О компании'], ['/contacts', 'Контакты'], ['/faq', 'FAQ']].map(([href, text]) => <Link href={href} key={href}>{t(text)}</Link>)}</nav></div>
      <div><h2>{c('office')}</h2><address><a href={officeMapUrl} target="_blank" rel="noreferrer">{c('address')} ↗</a></address><p>{c('hours')}</p><small>{c('timezone')}</small></div>
      <div className="company-footer-contacts"><h2>{t('Контакты менеджеров')}</h2><a href={whatsappLink(contacts)} target="_blank" rel="noreferrer">WhatsApp · {t(contacts.whatsappName || 'Менеджер')}<span>+{contacts.whatsapp}</span></a>{contacts.whatsappSecondary && <a href={whatsappLink({ ...contacts, whatsapp: contacts.whatsappSecondary })} target="_blank" rel="noreferrer">WhatsApp · {t(contacts.whatsappSecondaryName || 'Менеджер')}<span>+{contacts.whatsappSecondary}</span></a>}<a href={telegramLink(contacts)} target="_blank" rel="noreferrer">Telegram · @{contacts.telegram}</a><ManagerContacts asButton label="Все способы связи" className="market-text-button" /></div>
    </div>
    <div className="company-footer-bottom"><span>© 2021–{new Date().getFullYear()} firstseven avto</span><span>{t('Автомобили из Китая.')}</span></div>
  </footer>;
}
