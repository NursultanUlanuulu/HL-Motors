'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { useLocale } from './LocaleProvider';
import { useFavorites } from './FavoritesProvider';
import { useSiteData } from './SiteDataProvider';
import { MarketIcon } from './MarketIcon';
import { LanguageSwitcher } from './LanguageSwitcher';

const tabs = [
  ['/', 'Главная', 'home'], ['/catalog', 'Каталог', 'car'],
  ['/favorites', 'Избранное', 'heart'], ['/contacts', 'Контакты', 'contact'],
] as const;
const pages = [
  ['/delivery', 'Доставка и оплата', 'document'],
  ['/about', 'О компании', 'info'], ['/faq', 'FAQ', 'help'],
] as const;

export function MobileNavigation() {
  const { t } = useLocale(); const pathname = usePathname();
  const { ids } = useFavorites(); const { cars } = useSiteData();
  const count = cars.filter(car => ids.includes(car.id)).length;
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null); const id = useId();
  function close() { dialog.current?.close(); setOpen(false); }

  useEffect(() => { close(); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    element?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const desktop = window.matchMedia('(min-width: 1101px)');
    const resize = () => { if (desktop.matches) close(); };
    desktop.addEventListener('change', resize);
    return () => {
      element?.close(); document.body.style.overflow = previous;
      desktop.removeEventListener('change', resize);
    };
  }, [open]);

  return <>
    <nav className="market-bottom-nav" aria-label={t('Быстрая навигация')}>
      {tabs.map(([href, label, icon]) => <Link key={href} href={href}
        aria-current={pathname === href || (href === '/catalog' && pathname.startsWith('/catalog/')) ? 'page' : undefined}>
        <span className="market-bottom-icon"><MarketIcon name={icon} />{href === '/favorites' && count > 0 && <b>{count}</b>}</span>
        <span>{t(label)}</span>
      </Link>)}
      <button type="button" aria-expanded={open} aria-controls={id} aria-haspopup="dialog" data-active={pages.some(([href]) => href === pathname)} onClick={() => setOpen(true)}>
        <span className="market-bottom-icon"><MarketIcon name="more" /></span><span>{t('Ещё')}</span>
      </button>
    </nav>
    <dialog ref={dialog} id={id} className="market-more-sheet" aria-labelledby={id + '-title'}
      onClose={() => setOpen(false)} onCancel={event => { event.preventDefault(); close(); }}
      onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className="market-more-inner">
        <header><h2 id={id + '-title'}>{t('Ещё')}</h2><button type="button" onClick={close} aria-label={t('Закрыть меню')}><MarketIcon name="close" /></button></header>
        <nav aria-label={t('Информация для покупателей')}>
          {pages.map(([href, label, icon]) => <Link key={href} href={href} onClick={close} aria-current={pathname === href ? 'page' : undefined}><MarketIcon name={icon} /><span>{t(label)}</span><MarketIcon name="arrow" /></Link>)}
        </nav>
        <div className="market-more-language"><span>{t('Выбор языка')}</span><LanguageSwitcher /></div>
      </div>
    </dialog>
  </>;
}
