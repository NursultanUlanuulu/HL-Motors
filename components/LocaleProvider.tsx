'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { languageKey, parseLocale, translate, type Locale, type TranslationParams } from '@/lib/i18n';

const Context = createContext<{ locale: Locale; setLocale: (locale: Locale) => void; t: (text: string, params?: TranslationParams) => string } | null>(null);
const titles: Record<string, string> = {
  '/favorites': 'Избранное — Motors', '/delivery': 'Доставка и оплата — Motors', '/about': 'О компании — Motors', '/contacts': 'Контакты — Motors',
  '/': 'Motors — Автомобили из Китая', '/catalog': 'Автомобили — Motors', '/login': 'Вход — Motors',
  '/admin/vehicles': 'Автомобили — Админка Motors', '/admin/settings': 'Настройки — Админка Motors',
  '/admin/analytics': 'Аналитика — Админка Motors', '/admin/contacts': 'Обращения — Админка Motors',
};

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLanguage] = useState<Locale>('ru');
  const pathname = usePathname();
  useEffect(() => {
    try { setLanguage(parseLocale(localStorage.getItem(languageKey))); } catch { /* Language switching also works when persistence is unavailable. */ }
    const sync = (event: StorageEvent) => { if (event.key === languageKey || event.key === null) setLanguage(parseLocale(event.newValue)); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : locale;
    if (titles[pathname]) document.title = translate(titles[pathname], locale);
  }, [locale, pathname]);
  function setLocale(value: Locale) {
    setLanguage(value);
    try { localStorage.setItem(languageKey, value); } catch { /* Keep the selected language for this session. */ }
  }
  return <Context.Provider value={{ locale, setLocale, t: (text, params) => translate(text, locale, params) }}>{children}</Context.Provider>;
}

export function useLocale() {
  const value = useContext(Context);
  if (!value) throw new Error('LocaleProvider is required');
  return value;
}
