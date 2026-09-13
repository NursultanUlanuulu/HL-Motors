'use client';

import { useLocale } from '@/components/LocaleProvider';

import Link from 'next/link';
import { useSiteData } from './SiteDataProvider';
import { Brand } from './Brand';

export function Footer({ compact = false }: { compact?: boolean }) {
  const { t } = useLocale();
  const { contacts } = useSiteData();
  if (compact) return <footer><div className="footer-bottom"><span>© 2025 Motors</span><span>{t("Бишкек · Кыргызстан")}</span><span>{t("Россия · Беларусь · Казахстан")}</span><Link href="/catalog">{t("В каталог ↑")}</Link></div></footer>;
  return (
    <footer>
      <div className="footer-top"><Brand /><p>{t("Автомобили из Китая.")}<br />{t("С заботой о каждом километре.")}</p><a className="footer-email" href={`mailto:${contacts.email}`}>{contacts.email} <span>↗</span></a></div>
      <div className="footer-bottom"><span>© 2025 Motors</span><span>{t("Бишкек · Кыргызстан")}</span><span>{t("Россия · Беларусь · Казахстан")}</span><a href="#top">{t("Наверх ↑")}</a></div>
    </footer>
  );
}
