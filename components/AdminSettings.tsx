'use client';

import { useLocale } from '@/components/LocaleProvider';

import { useRef, useState, type FormEvent } from 'react';
import { useSiteData } from './SiteDataProvider';
import { ensureAdminSession } from '@/app/actions/auth';
import { normalizeContacts, type Contacts } from '@/lib/site-data';
import { AdminDataImport } from './AdminDataImport';
import { withDeadline, clientRequestTimeoutMs } from '@/lib/request-deadline';

export function AdminSettings() {
  const { t } = useLocale();
  const { contacts, contactsLoaded, contactsError, mode, saveContacts } = useSiteData();
  const [draft, setDraft] = useState<Contacts | null>(null);
  const originalContacts = useRef<Contacts | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const value = draft ?? contacts;
  function update(key: keyof Contacts, text: string) {
    if (!draft) originalContacts.current = contacts;
    setDraft({ ...value, [key]: text }); setMessage(''); setError('');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); setError('');
    try {
      const normalized = normalizeContacts({ ...value, email: undefined });
      if (mode === 'local' && !await withDeadline(() => ensureAdminSession(), { timeoutMs: clientRequestTimeoutMs })) throw new Error('Сессия завершена. Войдите в админку снова.');
      await saveContacts(normalized, originalContacts.current ?? contacts); setDraft(null); originalContacts.current = undefined; setMessage('Контакты сохранены и обновлены на сайте.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сохранить контакты.'); }
    finally { setBusy(false); }
  }
  return <><AdminDataImport /><section className="admin-panel admin-section-panel">
    <div className="admin-panel-top"><div><h2>{t("Контакты компании")}</h2><p>{t("Используются на главной странице, в карточках автомобилей и в подвале сайта.")}</p></div></div>
    <form className="admin-settings-form" onSubmit={submit}>
      <fieldset disabled={busy || !contactsLoaded}><div className="admin-form-grid">
        <label>{t('Имя первого менеджера')}<input maxLength={80} value={value.whatsappName ?? ''} onChange={event => update('whatsappName', event.target.value)} placeholder="HUA" /></label>
        <label>WhatsApp 1<input type="tel" maxLength={100} value={value.whatsapp} onChange={event => update('whatsapp', event.target.value)} placeholder="+8615060761179" required /></label>
        <label>{t('Имя второго менеджера')}<input maxLength={80} value={value.whatsappSecondaryName ?? ''} onChange={event => update('whatsappSecondaryName', event.target.value)} placeholder={t('Нурсултан')} /></label>
        <label>WhatsApp 2<input type="tel" maxLength={100} value={value.whatsappSecondary ?? ''} onChange={event => update('whatsappSecondary', event.target.value)} placeholder="+996502102270" /></label>
        <label className="wide">Telegram<input maxLength={100} value={value.telegram} onChange={event => update('telegram', event.target.value)} placeholder="@nursauto_kg" required /><small>{t("Имя пользователя или ссылка https://t.me/…")}</small></label>
        <label className="wide">WeChat ID<input maxLength={20} value={value.wechatId ?? ''} onChange={event => update('wechatId', event.target.value)} placeholder="YH15060761179" /></label>
        <label className="wide">{t('Изображение QR-кода WeChat')}<input maxLength={2048} value={value.wechatQr ?? ''} onChange={event => update('wechatQr', event.target.value)} placeholder="/contacts/wechat-hua.jpg" /><small>{t('HTTPS-ссылка или путь к изображению на сайте.')}</small></label>
      </div></fieldset>
      {(error || contactsError) && <p className="admin-media-error" role="alert">{t(error || contactsError)}</p>}
      {message && <p className="admin-save-success" role="status">{t(message)}</p>}
      <button className="admin-primary" disabled={busy || !contactsLoaded}>{t(busy ? 'Сохраняем…' : 'Сохранить контакты')}</button>
    </form>
  </section></>;
}
