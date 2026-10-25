'use client';

import { useLocale } from '@/components/LocaleProvider';

import Link from 'next/link';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Brand } from './Brand';
import { logout } from '@/app/actions/auth';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const navigation = [
  { href: '/admin/vehicles', label: 'Автомобили', icon: '▦' },
  { href: '/admin/analytics', label: 'Аналитика', icon: '◫' },
  { href: '/admin/contacts', label: 'Обращения', icon: '◌' },
  { href: '/admin/settings', label: 'Настройки', icon: '⚙' },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggle = useRef<HTMLButtonElement>(null);
  const title = navigation.find((item) => pathname === item.href)?.label ?? 'Панель управления';

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 900px)');
    const resize = () => setSidebarOpen(!mobile.matches);
    resize();
    mobile.addEventListener('change', resize);
    return () => mobile.removeEventListener('change', resize);
  }, []);

  useEffect(() => {
    if (window.matchMedia('(max-width: 900px)').matches) setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && sidebarOpen && !document.querySelector('.admin-editor-layer')) {
        setSidebarOpen(false);
        toggle.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [sidebarOpen]);

  function closeSidebar() {
    setSidebarOpen(false);
    toggle.current?.focus();
  }

  return <main className={`admin-shell admin-routed-shell${sidebarOpen ? '' : ' sidebar-closed'}`}>
    <aside className="admin-sidebar" id="admin-navigation" inert={!sidebarOpen}>
      <Brand admin />
      <button className="admin-nav-close" type="button" onClick={closeSidebar} aria-label={t("Закрыть меню")}>×</button>
      <nav aria-label={t("Навигация панели управления")}>
        {navigation.map((item) => <Link key={item.href} href={item.href} className={pathname === item.href ? 'active' : ''} aria-current={pathname === item.href ? 'page' : undefined} onClick={() => { if (window.matchMedia('(max-width: 900px)').matches) closeSidebar(); }}><i aria-hidden="true">{item.icon}</i>{t(item.label)}</Link>)}
      </nav>
      <div className="admin-profile"><div className="admin-avatar">{t("А")}</div><div><b>admin</b><span>{t("Администратор")}</span></div><form action={logout}><button className="admin-logout" type="submit">{t("Выйти")}</button></form></div>
    </aside>
    {sidebarOpen && <button className="admin-sidebar-backdrop" type="button" onClick={closeSidebar} aria-label={t("Закрыть меню")} />}
    <section className="admin-content">
      <header className="admin-header">
        <div className="admin-heading"><button ref={toggle} className="admin-sidebar-toggle" type="button" onClick={() => setSidebarOpen((current) => !current)} aria-controls="admin-navigation" aria-expanded={sidebarOpen} aria-label={t(sidebarOpen ? 'Скрыть меню' : 'Открыть меню')}><span aria-hidden="true">{sidebarOpen ? '←' : '☰'}</span><span>{t(sidebarOpen ? 'Скрыть меню' : 'Открыть меню')}</span></button><div><p>{t("firstseven avto / Панель управления")}</p><h1>{t(title)}</h1></div></div>
        <LanguageSwitcher admin />
        <a className="admin-view-site" href="/" target="_blank" rel="noreferrer">{t("Открыть сайт ↗")}</a>
      </header>
      {children}
    </section>
  </main>;
}
