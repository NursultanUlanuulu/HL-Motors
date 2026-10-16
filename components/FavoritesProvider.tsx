'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const key = 'hl-motors-favorites';
function parse(value: string | null): string[] {
  try { const data: unknown = JSON.parse(value ?? '[]'); return Array.isArray(data) ? [...new Set(data.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 160))].slice(0, 2000) : []; } catch { return []; }
}
const Context = createContext<{ ids: string[]; ready: boolean; saved: boolean; toggle: (id: string) => void } | null>(null);
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    try { setIds(parse(localStorage.getItem(key))); } catch { setSaved(false); }
    setReady(true);
    const sync = (event: StorageEvent) => { if (event.key === key || event.key === null) setIds(parse(event.newValue)); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  function toggle(id: string) {
    let latest = ids;
    try { if (saved) latest = parse(localStorage.getItem(key)); } catch { /* Session-only favorites still work. */ }
    const next = latest.includes(id) ? latest.filter(item => item !== id) : [...latest, id];
    setIds(next);
    try { localStorage.setItem(key, JSON.stringify(next)); setSaved(true); } catch { setSaved(false); }
  }
  return <Context.Provider value={{ ids, ready, saved, toggle }}>{children}</Context.Provider>;
}
export function useFavorites() {
  const value = useContext(Context);
  if (!value) throw new Error('FavoritesProvider is required');
  return value;
}
