'use client';

import { useLocale } from '@/components/LocaleProvider';

import { useSiteData } from './SiteDataProvider';
import { whatsappLink, telegramLink } from '@/lib/site-data';

export function ContactButtons() {
  const { t } = useLocale();
  const { contacts } = useSiteData();
  return <div className="contact-buttons">
    <a className="button button-gold" href={whatsappLink(contacts)} target="_blank" rel="noreferrer">{t("Написать в WhatsApp")} <span>↗</span></a>
    <a className="text-link contact-copy" href={telegramLink(contacts)} target="_blank" rel="noreferrer">{t("Написать в Telegram")} <span>↗</span></a>
  </div>;
}
