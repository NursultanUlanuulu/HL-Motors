import { redirect } from 'next/navigation';

export const metadata = { title: 'Панель управления — firstseven avto', robots: { index: false, follow: false } };

export default function AdminPage() {
  redirect('/admin/vehicles');
}
