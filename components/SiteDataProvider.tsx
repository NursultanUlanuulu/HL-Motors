'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cars as seedCars, type Car } from '@/lib/cars';
import { carsKey, contactsKey, defaultContacts, readCars, readContacts, writeCar, deleteCar, writeContacts, type Contacts } from '@/lib/site-data';
import { apiRequest, type CloudSnapshot } from '@/lib/cloud-client';
import type { DataMode } from '@/lib/cloud-validation';
import { createRefreshCoordinator } from '@/lib/refresh-coordinator';
import { withBrowserWriteLock } from '@/lib/browser-write-lock';
import { useLocale } from './LocaleProvider';

type SiteData = {
  cars: Car[]; contacts: Contacts; loaded: boolean; contactsLoaded: boolean; error: string; contactsError: string; mode: DataMode;
  refresh: () => Promise<void>;
  saveCar: (car: Car, previous?: Car) => Promise<Car[]>;
  removeCar: (car: Car) => Promise<Car[]>;
  saveContacts: (contacts: Contacts, previous?: Contacts) => Promise<void>;
};
const Context = createContext<SiteData | null>(null);
type RefreshSnapshot = Partial<CloudSnapshot> & { error?: string; contactsError?: string };

export function SiteDataProvider({ children, mode = 'local' }: { children: ReactNode; mode?: DataMode }) {
  const { t } = useLocale();
  const [cars, setCars] = useState<Car[]>(mode === 'local' ? seedCars : []);
  const [contacts, setContacts] = useState(defaultContacts);
  const [loaded, setLoaded] = useState(false);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [contactsError, setContactsError] = useState('');
  const currentCars = useRef(cars);
  const channel = useRef<BroadcastChannel | null>(null);
  const updateCars = useCallback((next: Car[]) => { currentCars.current = next; setCars(next); }, []);

  const coordinator = useMemo(() => createRefreshCoordinator({
    load: async (signal: AbortSignal): Promise<RefreshSnapshot> => {
      if (mode === 'supabase') return apiRequest<CloudSnapshot>('/api/site', undefined, 'GET', { signal });
      const snapshot: RefreshSnapshot = {};
      try { snapshot.cars = readCars(); }
      catch { snapshot.error = 'Не удалось прочитать каталог. Проверьте доступ к хранилищу браузера и сохранённые данные.'; }
      try { snapshot.contacts = readContacts(); }
      catch { snapshot.contactsError = 'Не удалось прочитать контакты из хранилища браузера.'; }
      return snapshot;
    },
    onData: snapshot => {
      if (snapshot.cars) { updateCars(snapshot.cars); setLoaded(true); }
      if (snapshot.contacts) { setContacts(snapshot.contacts); setContactsLoaded(true); }
      setError(snapshot.error ?? ''); setContactsError(snapshot.contactsError ?? '');
    },
    onError: err => {
      const message = err instanceof Error ? err.message : 'Не удалось связаться с сервером. Повторите попытку.';
      setError(message); setContactsError(message);
    },
  }), [mode, updateCars]);
  const refresh = coordinator.refresh;

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
      coordinator.dispose();
      window.removeEventListener('storage', onStorage); window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer); channel.current?.close(); channel.current = null;
    };
  }, [mode, refresh, coordinator]);

  const value: SiteData = {
    cars, contacts, loaded, contactsLoaded, error, contactsError, mode, refresh,
    saveCar(car, previous) {
      return coordinator.mutate(async () => {
        let next: Car[];
        if (mode === 'local') next = await withBrowserWriteLock(() => writeCar(car, previous));
        else {
          const result = await apiRequest<{ car: Car }>('/api/admin/vehicles', { car, previousVersion: previous?.version });
          next = [result.car, ...currentCars.current.filter(item => item.id !== result.car.id)];
          channel.current?.postMessage('changed');
        }
        updateCars(next); setLoaded(true); setError(''); return next;
      });
    },
    removeCar(car) {
      return coordinator.mutate(async () => {
        if (mode === 'supabase') await apiRequest('/api/admin/vehicles', { id: car.id, version: car.version }, 'DELETE');
        const next = mode === 'local' ? await withBrowserWriteLock(() => deleteCar(car)) : currentCars.current.filter(item => item.id !== car.id);
        updateCars(next); setError(''); channel.current?.postMessage('changed'); return next;
      });
    },
    saveContacts(value, previous) {
      const baseline = previous ?? contacts;
      return coordinator.mutate(async () => {
        const next = mode === 'local'
          ? await withBrowserWriteLock(() => writeContacts(value, baseline))
          : (await apiRequest<{ contacts: Contacts }>('/api/admin/contacts', { contacts: value, previous: baseline })).contacts;
        setContacts(next); setContactsLoaded(true); setContactsError(''); channel.current?.postMessage('changed');
      });
    },
  };
  const stale = (loaded && !!error) || (contactsLoaded && !!contactsError);
  return <Context.Provider value={value}>
    {stale && <div className="site-sync-notice" role="status"><span>{t('Не удалось обновить данные. Показана последняя загруженная версия.')}</span><button type="button" onClick={() => { void refresh(); }}>{t('Повторить')}</button></div>}
    {children}
  </Context.Provider>;
}

export function useSiteData() {
  const value = useContext(Context);
  if (!value) throw new Error('SiteDataProvider is required');
  return value;
}
