import { Suspense } from 'react';
import { CatalogClient } from './CatalogClient';
import { MarketFrame } from './MarketFrame';
export function CatalogPage({ favorites = false }: { favorites?: boolean }) {
  return <MarketFrame catalog={!favorites}><Suspense fallback={<main className="market-main"><div className="market-skeleton" aria-busy="true" /></main>}><CatalogClient favorites={favorites} /></Suspense></MarketFrame>;
}