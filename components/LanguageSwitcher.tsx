'use client';

import { useLocale } from './LocaleProvider';
import type { Locale } from '@/lib/i18n';

export function LanguageSwitcher({ admin = false }: { admin?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  return <select className={`locale-switcher${admin ? ' admin-locale-switcher' : ''}`} aria-label={t('Выбор языка')} value={locale} onChange={event => setLocale(event.target.value as Locale)}>
    {admin ? <><option value="zh">中文</option><option value="ru">Русский</option></> : <><option value="ru">Русский</option><option value="zh">中文</option></>}
  </select>;
}
