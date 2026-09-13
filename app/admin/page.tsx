import { redirect } from 'next/navigation';

export const metadata = { title: 'Панель управления — Motors', robots: { index: false, follow: false } };

export default function AdminPage() {
  redirect('/admin/vehicles');
}
