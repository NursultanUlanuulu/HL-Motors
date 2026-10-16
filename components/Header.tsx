'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
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
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const links = [['/catalog', 'Каталог'], ['/delivery', 'Доставка и оплата'], ['/about', 'О компании'], ['/contacts', 'Контакты']];
  function close() { dialog.current?.close(); setOpen(false); }
  useEffect(() => { close(); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; dialog.current?.close(); };
  }, [open]);
  const nav = links.map(([url, label]) => <Link key={url} href={url} onClick={close} aria-current={pathname === url || (url === '/catalog' && (active === 'catalog' || active === 'home')) ? 'page' : undefined}>{t(label)}</Link>);
  return <header className="market-header"><div className="market-header-inner">
    <Brand />
    <nav className="market-nav" aria-label={t('Основная навигация')}>{nav}</nav>
    <div className="market-header-actions"><Link className="market-saved-link" href="/favorites" aria-label={t('Избранное') + ': ' + count} aria-current={pathname === '/favorites' ? 'page' : undefined}><MarketIcon name="heart" /><span>{t('Избранное')}</span>{count > 0 && <b>{count}</b>}</Link><LanguageSwitcher /><button type="button" className="market-menu-button" aria-label={t('Открыть меню')} aria-expanded={open} aria-controls="market-navigation" onClick={() => setOpen(true)}>☰</button></div>
    <dialog ref={dialog} id="market-navigation" className="market-menu" onClose={() => setOpen(false)} aria-label={t('Основная навигация')} onClick={event => { if (event.target === event.currentTarget) close(); }}><div><button className="market-close" type="button" onClick={close} aria-label={t('Закрыть меню')}><MarketIcon name="close" /></button><nav>{nav}<Link href="/favorites" onClick={close}>{t('Избранное')} · {count}</Link></nav><LanguageSwitcher /></div></dialog>
  </div></header>;
}