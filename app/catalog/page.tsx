import { CatalogPage } from '@/components/CatalogPageContent';
import { catalogMetadata } from '@/lib/seo';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return catalogMetadata('/catalog', await searchParams);
}

export default function Page() { return <CatalogPage />; }
