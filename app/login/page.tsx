import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/LoginForm';

export const metadata = { title: 'Вход — Motors', robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await isAdmin()) redirect('/admin/vehicles');
  return <main className="admin-login"><LoginForm /></main>;
}
