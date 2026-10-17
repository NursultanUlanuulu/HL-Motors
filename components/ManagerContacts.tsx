'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useLocale } from './LocaleProvider';
import { useSiteData } from './SiteDataProvider';
import { telegramLink, whatsappLink } from '@/lib/site-data';

export function ManagerContacts({ message, asButton = false, label = 'Связаться с менеджером', className = 'market-primary' }: {
  message?: string; asButton?: boolean; label?: string; className?: string;
}) {
  const { contacts } = useSiteData(); const { t } = useLocale();
  const [view, setView] = useState<'contacts' | 'wechat' | null>(null);
  const [copyStatus, setCopyStatus] = useState(''); const [failedQr, setFailedQr] = useState('');
  const dialog = useRef<HTMLDialogElement>(null); const idInput = useRef<HTMLInputElement>(null); const titleId = useId();
  const open = view !== null;
  useEffect(() => {
    if (!open) return;
    const element = dialog.current; element?.showModal(); const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = previous; };
  }, [open]);
  function close() { dialog.current?.close(); setView(null); setCopyStatus(''); }
  async function copyId() {
    try { await navigator.clipboard.writeText(contacts.wechatId ?? ''); setCopyStatus('ID скопирован'); }
    catch { idInput.current?.focus(); idInput.current?.select(); setCopyStatus('Скопируйте выделенный ID вручную'); }
  }
  const managers = [
    { phone: contacts.whatsapp, name: contacts.whatsappName || t('Менеджер') },
    ...(contacts.whatsappSecondary ? [{ phone: contacts.whatsappSecondary, name: contacts.whatsappSecondaryName || t('Менеджер') }] : []),
  ];
  const channels = <div className="manager-channels">
    {managers.map(manager => <a key={manager.phone} className="manager-channel whatsapp" href={whatsappLink({ ...contacts, whatsapp: manager.phone }, message)} target="_blank" rel="noreferrer"><span className="manager-channel-icon" aria-hidden="true">W</span><span><b>WhatsApp · {t(manager.name)}</b><small>+{manager.phone}</small></span><span aria-hidden="true">↗</span></a>)}
    <a className="manager-channel telegram" href={telegramLink(contacts)} target="_blank" rel="noreferrer"><span className="manager-channel-icon" aria-hidden="true">↗</span><span><b>Telegram</b><small>@{contacts.telegram}</small></span><span aria-hidden="true">↗</span></a>
    {contacts.wechatId && <button type="button" className="manager-channel wechat" onClick={() => { setCopyStatus(''); setView('wechat'); }}><span className="manager-channel-icon" aria-hidden="true">微</span><span><b>WeChat</b><small>{contacts.wechatId}</small></span><span aria-hidden="true">⌗</span></button>}
  </div>;
  return <>
    {asButton ? <button type="button" className={className} onClick={() => setView('contacts')}>{t(label)}</button> : channels}
    <dialog ref={dialog} className="manager-dialog" aria-labelledby={titleId} onClose={() => { setView(null); setCopyStatus(''); }} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className="manager-dialog-inner"><header><h2 id={titleId}>{view === 'wechat' ? 'WeChat' : t('Связаться с менеджером')}</h2><button type="button" className="manager-dialog-close" aria-label={t('Закрыть')} onClick={close}>×</button></header>
        {view === 'contacts' && channels}
        {view === 'wechat' && <div className="wechat-contact">
          {asButton && <button className="market-text-button" type="button" onClick={() => setView('contacts')}>← {t('Все способы связи')}</button>}
          {contacts.wechatQr && failedQr !== contacts.wechatQr && <img className="wechat-qr" src={contacts.wechatQr} alt={t('QR-код WeChat менеджера')} onError={() => setFailedQr(contacts.wechatQr ?? '')} />}
          <p>{t('Отсканируйте QR-код в WeChat или добавьте менеджера по ID.')}</p>
          <label className="wechat-id">WeChat ID<input ref={idInput} readOnly value={contacts.wechatId ?? ''} onFocus={event => event.currentTarget.select()} /></label>
          <div className="wechat-actions"><button className="market-primary" type="button" onClick={() => void copyId()}>{t('Скопировать ID')}</button>{contacts.wechatQr && failedQr !== contacts.wechatQr && <a className="market-secondary" href={contacts.wechatQr} download="WeChat-HUA.jpg" target="_blank" rel="noreferrer">{t('Сохранить QR')}</a>}</div>
          <p className="wechat-copy-status" role="status">{copyStatus && t(copyStatus)}</p>
          <small>{t('На телефоне сохраните QR и выберите его из фото в сканере WeChat.')}</small>
        </div>}
      </div>
    </dialog>
  </>;
}
