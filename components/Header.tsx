'use client';

import { useLocale } from '@/components/LocaleProvider';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Brand } from './Brand';
import { LanguageSwitcher } from './LanguageSwitcher';

type HeaderProps = { active?: 'catalog' | 'home' };

export function Header({ active }: HeaderProps) {
  const { t } = useLocale();
  const [isLight, setIsLight] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  function closeMenu() {
    menu.current?.close();
    setMenuOpen(false);
  }

  useEffect(() => { closeMenu(); }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const dialog = menu.current;
    if (!dialog) return;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const desktop = window.matchMedia('(min-width: 851px)');
    const handleResize = () => { if (desktop.matches) closeMenu(); };
    desktop.addEventListener('change', handleResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener('change', handleResize);
      if (dialog.open) dialog.close();
    };
  }, [menuOpen]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('hl-theme') === 'light';
    setIsLight(savedTheme);
    document.body.classList.toggle('light', savedTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = !isLight;
    setIsLight(nextTheme);
    document.body.classList.toggle('light', nextTheme);
    localStorage.setItem('hl-theme', nextTheme ? 'light' : 'dark');
  }

  return (
    <header className={`site-header ${active === 'catalog' ? 'page-header' : ''}`}>
      <Brand />
      <nav className="desktop-nav" aria-label={t("Основная навигация")}>
        <Link className={active === 'catalog' ? 'active' : ''} href="/catalog">{t("Автомобили")}</Link>
        <Link href="/#process">{t("Как мы работаем")}</Link>
        <Link href="/#about">{t("О компании")}</Link>
        <Link href="/#contacts">{t("Контакты")}</Link>
      </nav>
      <div className="header-actions">
        <LanguageSwitcher />
        <button className="theme-toggle" aria-label={t("Переключить тему")} onClick={toggleTheme}><span className="theme-icon">◐</span></button>
        <button className="menu-toggle" type="button" aria-label={t("Открыть меню")} aria-controls="mobile-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><span></span><span></span></button>
      </div>
      <dialog ref={menu} id="mobile-navigation" className="mobile-menu" aria-label={t('Основная навигация')} onClose={() => setMenuOpen(false)} onClick={event => { if (event.target === event.currentTarget) closeMenu(); }}>
        <div className="mobile-menu-content">
          <div className="mobile-menu-header"><div onClick={closeMenu}><Brand /></div><button type="button" className="mobile-menu-close" onClick={closeMenu} aria-label={t('Закрыть меню')}>×</button></div>
          <nav className="mobile-menu-links" aria-label={t('Основная навигация')}>
            <Link href="/catalog" aria-current={active === 'catalog' ? 'page' : undefined} onClick={closeMenu}>{t('Автомобили')}<span aria-hidden="true">↗</span></Link>
            <Link href="/#process" onClick={closeMenu}>{t('Как мы работаем')}<span aria-hidden="true">↗</span></Link>
            <Link href="/#about" onClick={closeMenu}>{t('О компании')}<span aria-hidden="true">↗</span></Link>
            <Link href="/#contacts" onClick={closeMenu}>{t('Контакты')}<span aria-hidden="true">↗</span></Link>
          </nav>
          <div className="mobile-menu-bottom"><span>{t('Выбор языка')}</span><LanguageSwitcher /></div>
        </div>
      </dialog>
    </header>
  );
}
