'use client';

import { useLocale } from '@/components/LocaleProvider';

import { useState, type FormEvent } from 'react';
import { useSiteData } from './SiteDataProvider';
import { ensureAdminSession } from '@/app/actions/auth';
import { normalizeContacts, type Contacts } from '@/lib/site-data';

export function AdminSettings() {
  const { t } = useLocale();
  const { contacts, contactsLoaded, contactsError, saveContacts } = useSiteData();
  const [draft, setDraft] = useState<Contacts | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const value = draft ?? contacts;
  function update(key: keyof Contacts, text: string) {
    setDraft({ ...value, [key]: text }); setMessage(''); setError('');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); setError('');
    try {
      const normalized = normalizeContacts(value);
      if (!await ensureAdminSession()) throw new Error('Сессия завершена. Войдите в админку снова.');
      saveContacts(normalized); setDraft(null); setMessage('Контакты сохранены и обновлены на сайте.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сохранить контакты.'); }
    finally { setBusy(false); }
  }
  return <section className="admin-panel admin-section-panel">
    <div className="admin-panel-top"><div><h2>{t("Контакты компании")}</h2><p>{t("Используются на главной странице, в карточках автомобилей и в подвале сайта.")}</p></div></div>
    <form className="admin-settings-form" onSubmit={submit}>
      <fieldset disabled={busy || !contactsLoaded}><div className="admin-form-grid">
        <label className="wide">WhatsApp<input type="tel" value={value.whatsapp} onChange={event => update('whatsapp', event.target.value)} placeholder="+996 502 102 270" required /><small>{t("Номер с кодом страны или ссылка https://wa.me/…")}</small></label>
        <label className="wide">Telegram<input value={value.telegram} onChange={event => update('telegram', event.target.value)} placeholder="@nur6ultan" required /><small>{t("Имя пользователя или ссылка https://t.me/…")}</small></label>
        <label className="wide">Email<input type="email" value={value.email} onChange={event => update('email', event.target.value)} placeholder="hello@hlmotors.com" required /></label>
      </div></fieldset>
      {(error || contactsError) && <p className="admin-media-error" role="alert">{t(error || contactsError)}</p>}
      {message && <p className="admin-save-success" role="status">{t(message)}</p>}
      <button className="admin-primary" disabled={busy || !contactsLoaded}>{t(busy ? 'Сохраняем…' : 'Сохранить контакты')}</button>
    </form>
  </section>;
}
