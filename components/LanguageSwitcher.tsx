'use client';

import { useLocale } from './LocaleProvider';
import type { Locale } from '@/lib/i18n';

export function LanguageSwitcher({ admin = false }: { admin?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  const languages: Locale[] = admin ? ['zh', 'en', 'ru'] : ['ru', 'en', 'zh'];
  return <div className={`locale-switcher${admin ? ' admin-locale-switcher' : ''}`} role="group" aria-label={t('Выбор языка')}>
    {languages.map(language => <button
      key={language}
      type="button"
      className="locale-switcher-button"
      aria-label={language === 'ru' ? 'RU — Русский' : language === 'en' ? 'EN — English' : 'CN — 中文'}
      title={language === 'ru' ? 'Русский' : language === 'en' ? 'English' : '中文'}
      aria-pressed={locale === language}
      onClick={() => setLocale(language)}
    >{language === 'ru' ? 'RU' : language === 'en' ? 'EN' : 'CN'}</button>)}
  </div>;
}
