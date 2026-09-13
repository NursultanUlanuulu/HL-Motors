import type { ReactNode } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin-auth';

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!await isAdmin()) redirect('/login');
  return <AdminShell>{children}</AdminShell>;
}
