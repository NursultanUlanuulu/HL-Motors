'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from './LocaleProvider';
import { Brand } from './Brand';
import { LanguageSwitcher } from './LanguageSwitcher';
import { MarketIcon } from './MarketIcon';
import { useFavorites } from './FavoritesProvider';
import { useSiteData } from './SiteDataProvider';

export function Header({ active }: { active?: 'catalog' | 'home' }) {
  const { t } = useLocale();
  const { ids } = useFavorites();
  const { cars } = useSiteData();
  const count = cars.filter(car => ids.includes(car.id)).length;
  const pathname = usePathname();
  const links = [['/catalog', 'Каталог'], ['/delivery', 'Доставка и оплата'], ['/about', 'О компании'], ['/contacts', 'Контакты'], ['/faq', 'FAQ']];
  const nav = links.map(([url, label]) => <Link key={url} href={url} aria-current={pathname === url || (url === '/catalog' && (active === 'catalog' || active === 'home')) ? 'page' : undefined}>{t(label)}</Link>);
  return <header className="market-header"><div className="market-header-inner">
    <Brand />
    <nav className="market-nav" aria-label={t('Основная навигация')}>{nav}</nav>
    <div className="market-header-actions"><Link className="market-saved-link" href="/favorites" aria-label={t('Избранное') + ': ' + count} aria-current={pathname === '/favorites' ? 'page' : undefined}><MarketIcon name="heart" /><span>{t('Избранное')}</span>{count > 0 && <b>{count}</b>}</Link><LanguageSwitcher /></div>
  </div></header>;
}
