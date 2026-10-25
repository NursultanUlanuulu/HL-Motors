'use client';

import { useLocale } from '@/components/LocaleProvider';

import Link from 'next/link';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useActionState } from 'react';
import { login } from '@/app/actions/auth';

export function LoginForm() {
  const { t } = useLocale();
  const [state, action, pending] = useActionState(login, { error: '' });
  return <form action={action} className="admin-login-card">
    <LanguageSwitcher admin />
    <p className="eyebrow">{t("firstseven avto / Панель управления")}</p>
    <h1>{t("Вход администратора")}</h1>
    <label>{t("Логин")}<input name="username" autoComplete="username" required autoFocus /></label>
    <label>{t("Пароль")}<input name="password" type="password" autoComplete="current-password" required /></label>
    {state.error && <p className="admin-media-error" role="alert">{t(state.error)}</p>}
    <button className="admin-primary" disabled={pending}>{t(pending ? 'Входим…' : 'Войти')}</button>
    <Link href="/">{t("← Вернуться на сайт")}</Link>
  </form>;
}
