import type { Metadata } from 'next';
import '../styles.css';
import '../marketplace.css';
import { FavoritesProvider } from '@/components/FavoritesProvider';
import { SiteDataProvider } from '@/components/SiteDataProvider';
import { LocaleProvider } from '@/components/LocaleProvider';
import { getDataMode } from '@/lib/supabase-server';
import { getPublicSnapshot } from '@/lib/public-snapshot';
import { siteUrl } from '@/lib/seo';
import { connection } from 'next/server';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  verification: { google: 'YAyTimTO9J1hq3oMJjHJhSTDWsoY5oT-9qfTJ6LVF50' },
  title: 'firstseven avto — Автомобили из Китая',
  description: 'Продажа автомобилей из Китая: подбор, осмотр, доставка и оформление. firstseven avto, Бишкек.',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  // Keep the shell and sign-in available during a data outage; the client can retry.
  const initial = await getPublicSnapshot().catch(() => undefined);
  return <html lang="ru"><head><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" /><link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet" /></head><body><div className="noise" aria-hidden="true"></div><LocaleProvider><SiteDataProvider mode={getDataMode()} initial={initial}><FavoritesProvider>{children}</FavoritesProvider></SiteDataProvider></LocaleProvider></body></html>;
}
