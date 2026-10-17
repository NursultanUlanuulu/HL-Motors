import type { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { MobileNavigation } from './MobileNavigation';
export function MarketFrame({ children, catalog = false }: { children: ReactNode; catalog?: boolean }) {
  return <div className="marketplace"><Header active={catalog ? 'catalog' : undefined} />{children}<Footer /><MobileNavigation /></div>;
}
