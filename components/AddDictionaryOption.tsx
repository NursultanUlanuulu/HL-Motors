'use client';
import { useEffect, useRef, useState } from 'react';
import { existingValue, type DictionaryGroup } from '@/lib/custom-options';
import { useSiteData } from './SiteDataProvider';
import { useLocale } from './LocaleProvider';

export function AddDictionaryOption({ group, label, onSelect }: { group: DictionaryGroup; label: string; onSelect: (value: string) => void }) {
  const { t } = useLocale();
  const { addOption, options } = useSiteData();
  const [open, setOpen] = useState(false);
  const [ru, setRu] = useState(''), [en, setEn] = useState(''), [zh, setZh] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const select = useRef(onSelect);
  select.current = onSelect;
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const duplicate = ru.trim() && existingValue(options, group, ru);
  async function submit() {
    if (!ru.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const value = duplicate || await addOption({ category: group, ru: ru.trim(), en: en.trim(), zh: zh.trim() });
      if (mounted.current) {
        select.current(value);
        setOpen(false); setRu(''); setEn(''); setZh('');
      }
    } catch (err) { if (mounted.current) setError(err instanceof Error ? err.message : 'Не удалось сохранить вариант.'); }
    finally { if (mounted.current) setBusy(false); }
  }
  if (!open) return <button type="button" className="dictionary-add" aria-label={label + ' · ' + t('Добавить вариант')} onClick={() => { setError(''); setOpen(true); }}>+ {t('Добавить вариант')}</button>;
  return <div className="dictionary-entry" role="group" aria-label={label} onKeyDown={event => { if (event.key === 'Enter' && event.target instanceof HTMLInputElement) { event.preventDefault(); void submit(); } }}>
    <label>{t('Название варианта')}<input autoFocus maxLength={80} value={ru} disabled={busy} onChange={e => setRu(e.target.value)} /></label>
    {duplicate ? <small>{t('Уже есть в списке')}</small> : <>
      <label>{t('Перевод на английский (необязательно)')}<input lang="en" maxLength={80} value={en} disabled={busy} onChange={e => setEn(e.target.value)} /></label>
      <label>{t('Перевод на китайский (необязательно)')}<input lang="zh" maxLength={80} value={zh} disabled={busy} onChange={e => setZh(e.target.value)} /></label>
    </>}
    {error && <small role="alert">{t(error)}</small>}
    <div><button type="button" disabled={!ru.trim() || busy} onClick={() => void submit()}>{t(duplicate ? 'Выбрать' : 'Добавить и выбрать')}</button> <button type="button" disabled={busy} onClick={() => setOpen(false)}>{t('Отмена')}</button></div>
  </div>;
}
