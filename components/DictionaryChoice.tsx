'use client';
import { customLabel, customValue, fixedChoices } from '@/lib/custom-options';
import { AddDictionaryOption } from './AddDictionaryOption';
import { SearchSelect } from './SearchSelect';
import { useSiteData } from './SiteDataProvider';
import { useLocale } from './LocaleProvider';

export function DictionaryChoice({ group, label, value, onChange }: { group: 'status' | 'condition' | 'customsType'; label: string; value: string; onChange: (value: string) => void }) {
  const { locale, t } = useLocale();
  const { options } = useSiteData();
  const choices = [...fixedChoices(group), ...options.filter(entry => entry.category === group).map(customValue)];
  return <div><SearchSelect label={t(label)} value={value} onChange={next => { if (next || group === 'customsType') onChange(next); }} required={group !== 'customsType'} placeholder={t('Не указано')} options={choices.map(item => ({ value: item, label: customLabel(options, group, item, locale) }))} />
    <AddDictionaryOption group={group} label={t(label)} onSelect={onChange} /></div>;
}
