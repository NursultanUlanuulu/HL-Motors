import { Suspense } from 'react';
import { CatalogClient } from './CatalogClient';
import { MarketFrame } from './MarketFrame';
import { getPublicSnapshot } from '@/lib/public-snapshot';
export async function CatalogPage({ favorites = false }: { favorites?: boolean }) {
  // A temporary database failure must not look like an empty indexed catalogue.
  if (!favorites) await getPublicSnapshot();
  return <MarketFrame catalog={!favorites}><Suspense fallback={<main className="market-main"><div className="market-skeleton" aria-busy="true" /></main>}><CatalogClient favorites={favorites} /></Suspense></MarketFrame>;
}
