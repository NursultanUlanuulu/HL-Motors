'use client';

import { useState } from 'react';
import { useLocale } from './LocaleProvider';
import type { Car, CarTextField } from '@/lib/cars';
import { carTextLimits } from '@/lib/cars';
import type { Locale } from '@/lib/i18n';
import { updateCarText } from '@/lib/car-translations';

const fields: [CarTextField, string][] = [
  ['brand', 'Марка'], ['model', 'Модель'], ['trim', 'Комплектация'], ['mileage', 'Пробег'], ['city', 'Город / локация'],
  ['body', 'Тип кузова'], ['color', 'Цвет кузова'], ['transmission', 'Коробка передач'], ['engine', 'Двигатель'], ['power', 'Мощность'], ['drive', 'Привод'],
];

export function CarTextEditor({ car, onChange }: { car: Car; onChange: (car: Car) => void }) {
  const { locale, t } = useLocale();
  const [language, setLanguage] = useState<Locale>(locale);
  return <fieldset className="car-text-editor"><legend>{t('Текст объявления')}</legend>
    <p className="admin-media-help">{t('Заполните марку и модель хотя бы на одном языке. Если перевода нет, посетитель увидит доступный вариант.')}</p>
    <div className="car-language-tabs" role="group" aria-label={t('Текст объявления')}>
      {(['ru', 'zh'] as const).map(lang => <button type="button" key={lang} aria-pressed={language === lang} onClick={() => setLanguage(lang)}>{lang === 'ru' ? 'Русский' : '中文'}</button>)}
    </div>
    <div className="admin-form-grid">
      {fields.map(([field, label]) => <label key={field} className={field === 'trim' ? 'wide' : undefined}>{t(label)} · {language === 'ru' ? 'RU' : '中文'}
        <input maxLength={carTextLimits[field]} lang={language === 'zh' ? 'zh-CN' : 'ru'} value={car.translations?.[language]?.[field] ?? (language === 'ru' ? car[field] ?? '' : '')} onChange={event => onChange(updateCarText(car, language, field, event.target.value))} />
      </label>)}
    </div>
  </fieldset>;
}
