import type { SVGProps } from 'react';

export function MarketIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: 'heart' | 'search' | 'pin' | 'filter' | 'arrow' | 'close' | 'home' | 'car' | 'contact' | 'more' | 'info' | 'document' | 'help' }) {
  const paths = {
    heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
    search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    filter: 'M3 5h18M6 12h12M9 19h6', arrow: 'M5 12h14m-6-6 6 6-6 6', close: 'm6 6 12 12M6 18 18 6',
    home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1V10Z',
    car: 'm5 8 2-5h10l2 5M3 16V9l2-1h14l2 1v7H3Zm2 0v4m14-4v4M6 12h2m8 0h2',
    contact: 'M4 13v-2a8 8 0 0 1 16 0v5a4 4 0 0 1-4 4h-3M4 11H2v6h4v-6H4Zm16 0h2v6h-4v-6h2Z',
    more: 'M4 11h2v2H4zM11 11h2v2h-2zM18 11h2v2h-2z',
    info: 'M12 17v-5m0-5v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
    document: 'M6 3h9l4 4v14H6V3Zm8 0v5h5M9 12h7m-7 4h7',
    help: 'M9 8a3 3 0 1 1 5 2.2c-1 .8-2 1-2 2.8m0 4v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
