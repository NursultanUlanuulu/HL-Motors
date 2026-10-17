'use client';
import Link from 'next/link';
import { MarketFrame } from './MarketFrame';
import { useLocale } from './LocaleProvider';
import { ManagerContacts } from './ManagerContacts';
import { companyContent, companyFaq, officeMapUrl, orderSteps } from '@/lib/company-content';

export function MarketInfo({ kind }: { kind: 'delivery' | 'about' | 'contacts' | 'faq' }) {
  const { locale, t } = useLocale();
  const c = (key: keyof typeof companyContent) => companyContent[key][locale];
  const title = kind === 'delivery' ? t('Доставка и оплата') : kind === 'about' ? t('О компании') : kind === 'faq' ? c('faqTitle') : t('Контакты');
  const lead = kind === 'delivery' ? 'deliveryLead' : kind === 'about' ? 'aboutLead' : kind === 'faq' ? 'faqLead' : 'contactsLead';
  const card = (heading: keyof typeof companyContent, body: keyof typeof companyContent) => <section className="market-info-section" key={heading}><h2>{c(heading)}</h2><p>{c(body)}</p></section>;
  const stats = kind === 'about' ? [['2021', 'founded'], ['10+', 'chinaYears'], ['5+', 'kyrgyzYears']] as const : [[c('from14'), 'deliveryTime'], ['50–80%', 'advance'], [c('cash'), 'officePayment']] as const;
  return <MarketFrame><main className="market-main market-info company-page">
    <nav className="market-breadcrumbs" aria-label={t('Навигация по страницам')}><Link href="/catalog">{t('Каталог')}</Link><span>/</span><span>{title}</span></nav>
    <div className="company-heading"><span className="company-kicker">HL MOTORS · {c('since')}</span><h1>{title}</h1><p className="market-info-lead">{c(lead)}</p></div>
    {(kind === 'about' || kind === 'delivery') && <div className="company-stats">{stats.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{c(label)}</span></div>)}</div>}
    {kind === 'about' && <>
      <section className="company-section"><h2>{c('twoTeams')}</h2><div className="market-info-grid">{card('chinaTeam', 'chinaTeamBody')}{card('kyrgyzTeam', 'kyrgyzTeamBody')}</div></section>
      <section className="company-section"><h2>{c('process')}</h2><ol className="company-steps">{orderSteps.map(([heading, body], index) => <li key={heading}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{c(heading)}</h3><p>{c(body)}</p></div></li>)}</ol></section>
      <div className="company-inline-links"><Link href="/catalog" className="market-primary">{t('Перейти в каталог')}</Link><Link href="/delivery" className="market-secondary">{t('Доставка и оплата')} ↗</Link></div>
    </>}
    {kind === 'delivery' && <>
      <section className="company-section"><h2>{c('included')}</h2><div className="market-info-grid">{card('stockTitle', 'stockBody')}{card('orderTitle', 'orderBody')}</div></section>
      <section className="company-payment market-info-section"><h2>{c('paymentTitle')}</h2><p>{c('paymentBody')}</p><Link href="/contacts">{c('office')} · {c('address')} ↗</Link></section>
      <div className="market-info-grid company-section">{card('logisticsTitle', 'logisticsBody')}{card('collectionTitle', 'collectionBody')}{card('cancellationTitle', 'cancellationBody')}{card('damageTitle', 'damageBody')}</div>
    </>}
    {kind === 'contacts' && <div className="market-info-grid company-office">
      <section className="market-info-section"><h2>{c('office')}</h2><address>{c('address')}</address><a className="company-map-link" href={officeMapUrl} target="_blank" rel="noreferrer">{c('map')} ↗</a></section>
      <section className="market-info-section"><h2>{c('hoursTitle')}</h2><p className="company-hours">{c('hours')}</p><p>{c('timezone')}</p></section>
    </div>}
    {kind === 'faq' && <div className="company-faq">{companyFaq.map(([question, answer]) => <details key={question}><summary><span>{c(question)}</span><i aria-hidden="true">+</i></summary><p>{c(answer)}</p></details>)}</div>}
    {kind !== 'contacts' && <section className="company-question"><div><h2>{c('faqMore')}</h2><p>{c('faqContact')}</p></div>{kind !== 'faq' && <Link href="/faq" className="market-secondary">FAQ ↗</Link>}</section>}
    <section className="market-manager-section"><h2>{t('Контакты менеджеров')}</h2><ManagerContacts /></section>
  </main></MarketFrame>;
}
