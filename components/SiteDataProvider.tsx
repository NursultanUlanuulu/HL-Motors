'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { cars as seedCars, type Car } from '@/lib/cars';
import { carsKey, contactsKey, defaultContacts, readCars, readContacts, writeCar, deleteCar, writeContacts, type Contacts } from '@/lib/site-data';
import { apiRequest, type CloudSnapshot } from '@/lib/cloud-client';
import type { DataMode } from '@/lib/cloud-validation';

type SiteData = {
  cars: Car[]; contacts: Contacts; loaded: boolean; contactsLoaded: boolean; error: string; contactsError: string; mode: DataMode;
  refresh: () => Promise<void>;
  saveCar: (car: Car, previous?: Car) => Promise<Car[]>;
  removeCar: (car: Car) => Promise<Car[]>;
  saveContacts: (contacts: Contacts, previous?: Contacts) => Promise<void>;
};
const Context = createContext<SiteData | null>(null);

export function SiteDataProvider({ children, mode = 'local' }: { children: ReactNode; mode?: DataMode }) {
  const [cars, setCars] = useState<Car[]>(mode === 'local' ? seedCars : []);
  const [contacts, setContacts] = useState(defaultContacts);
  const [loaded, setLoaded] = useState(false);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [contactsError, setContactsError] = useState('');
  const currentCars = useRef(cars);
  const generation = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const updateCars = useCallback((next: Car[]) => { currentCars.current = next; setCars(next); }, []);

  const refresh = useCallback(async () => {
    const requestGeneration = ++generation.current;
    if (mode === 'local') {
      try { updateCars(readCars()); setLoaded(true); setError(''); }
      catch { setLoaded(false); setError('Не удалось прочитать каталог. Проверьте доступ к хранилищу браузера и сохранённые данные.'); }
      try { setContacts(readContacts()); setContactsLoaded(true); setContactsError(''); }
      catch { setContactsLoaded(false); setContactsError('Не удалось прочитать контакты из хранилища браузера.'); }
      return;
    }
    try {
      const snapshot = await apiRequest<CloudSnapshot>('/api/site');
      if (generation.current !== requestGeneration) return;
      updateCars(snapshot.cars); setContacts(snapshot.contacts);
      setLoaded(true); setContactsLoaded(true); setError(''); setContactsError('');
    } catch (err) {
      if (generation.current !== requestGeneration) return;
      const message = err instanceof Error ? err.message : 'Не удалось связаться с сервером. Повторите попытку.';
      setError(message); setContactsError(message);
      // Keep the last successful snapshot, but never fall back to local browser data.
    }
  }, [mode, updateCars]);

  useEffect(() => {
    void refresh();
    const onStorage = (event: StorageEvent) => { if (mode === 'local' && (event.key === null || event.key === carsKey || event.key === contactsKey)) void refresh(); };
    const onVisible = () => { if (mode === 'supabase' && document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    if (mode === 'supabase' && typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('motors-cloud-updates');
      channel.current.onmessage = () => { void refresh(); };
    }
    const timer = mode === 'supabase' ? window.setInterval(onVisible, 30000) : undefined;
    return () => {
      generation.current++;
      window.removeEventListener('storage', onStorage); window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer); channel.current?.close(); channel.current = null;
    };
  }, [mode, refresh]);

  const value: SiteData = {
    cars, contacts, loaded, contactsLoaded, error, contactsError, mode, refresh,
    async saveCar(car, previous) {
      generation.current++;
      let next: Car[];
      if (mode === 'local') next = writeCar(car, previous);
      else {
        const result = await apiRequest<{ car: Car }>('/api/admin/vehicles', { car, previousVersion: previous?.version });
        next = [result.car, ...currentCars.current.filter(item => item.id !== result.car.id)];
        channel.current?.postMessage('changed');
      }
      generation.current++; updateCars(next); setLoaded(true); setError(''); return next;
    },
    async removeCar(car) {
      generation.current++;
      if (mode === 'supabase') await apiRequest('/api/admin/vehicles', { id: car.id, version: car.version }, 'DELETE');
      const next = mode === 'local' ? deleteCar(car) : currentCars.current.filter(item => item.id !== car.id);
      generation.current++; updateCars(next); setError(''); channel.current?.postMessage('changed'); return next;
    },
    async saveContacts(value, previous) {
      generation.current++;
      const next = mode === 'local' ? writeContacts(value) : (await apiRequest<{ contacts: Contacts }>('/api/admin/contacts', { contacts: value, previous: previous ?? contacts })).contacts;
      generation.current++; setContacts(next); setContactsLoaded(true); setContactsError(''); channel.current?.postMessage('changed');
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSiteData() {
  const value = useContext(Context);
  if (!value) throw new Error('SiteDataProvider is required');
  return value;
}
