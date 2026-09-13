'use client';

import { useLocale } from '@/components/LocaleProvider';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Brand } from './Brand';
import { LanguageSwitcher } from './LanguageSwitcher';

type HeaderProps = { active?: 'catalog' | 'home' };

export function Header({ active }: HeaderProps) {
  const { t } = useLocale();
  const [isLight, setIsLight] = useState(false);

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
        <button className="menu-toggle" aria-label={t("Открыть меню")}><span></span><span></span></button>
      </div>
    </header>
  );
}
