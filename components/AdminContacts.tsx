'use client';

import { useLocale } from '@/components/LocaleProvider';

import Link from 'next/link';



export function AdminContactsPage() {
  const { t } = useLocale();
  return <section className="admin-panel admin-section-panel">
    <div className="admin-panel-top"><div><h2>{t("Обращения клиентов")}</h2><p>{t("Заявки по автомобилям и обращения через мессенджеры.")}</p></div></div>
    <div className="admin-section-empty"><span aria-hidden="true">◌</span><h3>{t("Приём обращений пока не подключён")}</h3><p>{t("После подключения здесь появятся обращения клиентов с автомобилем, датой и каналом связи.")}</p></div>
    <Link className="admin-section-link" href="/admin/vehicles">{t("Перейти к автомобилям →")}</Link>
  </section>;
}
