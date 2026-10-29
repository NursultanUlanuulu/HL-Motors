import type { MetadataRoute } from 'next';
import { getPublicSnapshot } from '@/lib/public-snapshot';
import { getDataMode } from '@/lib/supabase-server';
import { siteUrl } from '@/lib/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { cars } = await getPublicSnapshot();
  const pages: MetadataRoute.Sitemap = ['', '/catalog', '/about', '/delivery', '/contacts', '/faq'].map(path => ({ url: siteUrl + path }));
  // Browser-local demo records are not public inventory.
  if (getDataMode() === 'local') return pages;
  return [...pages, ...cars.map(car => ({ url: `${siteUrl}/catalog/${encodeURIComponent(car.id)}`,
    ...(car.image ? { images: [car.image] } : {}) }))];
}
