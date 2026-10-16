'use client';

import { useState } from 'react';
import { useLocale } from './LocaleProvider';
import type { Car, CarTextField } from '@/lib/cars';
import { carTextLimits } from '@/lib/cars';
import type { Locale } from '@/lib/i18n';
import { editableCarText, updateCarText } from '@/lib/car-translations';

const fields: [CarTextField, string][] = [
  ['model', 'Модель'], ['trim', 'Комплектация'], ['city', 'Город / локация'], ['engine', 'Двигатель'],
  ['title', 'Заголовок объявления'], ['remark', 'Описание и замечания'], ['highlights', 'Краткие преимущества'],
  ['metaTitle', 'SEO-заголовок'], ['metaDescription', 'SEO-описание'],
];

export function CarTextEditor({ car, onChange }: { car: Car; onChange: (car: Car) => void }) {
  const { locale, t } = useLocale();
  const [language, setLanguage] = useState<Locale>(locale);
  return <fieldset className="car-text-editor"><legend>{t('Текст объявления')}</legend>
    <p className="admin-media-help">{t('Модель, комплектацию и описание заполните на нужных языках. При отсутствии перевода показывается доступный текст.')}</p>
    <div className="car-language-tabs" role="group" aria-label={t('Текст объявления')}>
      {(['ru', 'en', 'zh'] as const).map(lang => <button type="button" key={lang} aria-pressed={language === lang} onClick={() => setLanguage(lang)}>{lang === 'ru' ? 'Русский' : lang === 'en' ? 'English' : '中文'}</button>)}
    </div>
    <div className="admin-form-grid">
      {fields.map(([field, label]) => <label key={field} className={['trim', 'title', 'remark', 'highlights', 'metaDescription'].includes(field) ? 'wide' : undefined}>{t(label)} · {language.toUpperCase()}
        {['remark', 'highlights', 'metaDescription'].includes(field)
          ? <textarea rows={field === 'remark' ? 5 : 2} maxLength={carTextLimits[field]} lang={language === 'zh' ? 'zh-CN' : language} value={editableCarText(car, language, field)} onChange={event => onChange(updateCarText(car, language, field, event.target.value))} />
          : <input maxLength={carTextLimits[field]} lang={language === 'zh' ? 'zh-CN' : language} value={editableCarText(car, language, field)} onChange={event => onChange(updateCarText(car, language, field, event.target.value))} />}
      </label>)}
    </div>
  </fieldset>;
}
