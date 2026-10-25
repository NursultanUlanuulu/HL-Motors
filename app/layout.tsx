import type { Metadata } from 'next';
import '../styles.css';
import '../marketplace.css';
import { FavoritesProvider } from '@/components/FavoritesProvider';
import { SiteDataProvider } from '@/components/SiteDataProvider';
import { LocaleProvider } from '@/components/LocaleProvider';
import { getDataMode } from '@/lib/supabase-server';

export const metadata: Metadata = {
  title: 'firstseven avto — Автомобили из Китая',
  description: 'Поставка автомобилей из Китая под ключ: проверка, доставка и оформление.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><head><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" /><link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet" /></head><body><div className="noise" aria-hidden="true"></div><LocaleProvider><SiteDataProvider mode={getDataMode()}><FavoritesProvider>{children}</FavoritesProvider></SiteDataProvider></LocaleProvider></body></html>;
}
