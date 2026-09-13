'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { cars as seedCars, type Car } from '@/lib/cars';
import { carsKey, contactsKey, defaultContacts, readCars, readContacts, writeCar, deleteCar, writeContacts, type Contacts } from '@/lib/site-data';

type SiteData = {
  cars: Car[]; contacts: Contacts; loaded: boolean; contactsLoaded: boolean; error: string; contactsError: string;
  saveCar: (car: Car, previous?: Car) => Car[];
  removeCar: (car: Car) => Car[];
  saveContacts: (contacts: Contacts) => void;
};
const Context = createContext<SiteData | null>(null);

export function SiteDataProvider({ children }: { children: ReactNode }) {
  const [cars, setCars] = useState(seedCars);
  const [contacts, setContacts] = useState(defaultContacts);
  const [loaded, setLoaded] = useState(false);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [contactsError, setContactsError] = useState('');

  useEffect(() => {
    function loadCars() {
      try { setCars(readCars()); setLoaded(true); setError(''); }
      catch { setLoaded(false); setError('Не удалось прочитать каталог. Проверьте доступ к хранилищу браузера и сохранённые данные.'); }
    }
    function loadContacts() {
      try { setContacts(readContacts()); setContactsLoaded(true); setContactsError(''); }
      catch { setContactsLoaded(false); setContactsError('Не удалось прочитать контакты из хранилища браузера.'); }
    }
    function onStorage(event: StorageEvent) {
      if (event.key === null || event.key === carsKey) loadCars();
      if (event.key === null || event.key === contactsKey) loadContacts();
    }
    loadCars(); loadContacts();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value: SiteData = {
    cars, contacts, loaded, contactsLoaded, error, contactsError,
    saveCar(car, previous) { const next = writeCar(car, previous); setCars(next); return next; },
    removeCar(car) { const next = deleteCar(car); setCars(next); return next; },
    saveContacts(value) { setContacts(writeContacts(value)); setContactsLoaded(true); setContactsError(''); },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSiteData() {
  const value = useContext(Context);
  if (!value) throw new Error('SiteDataProvider is required');
  return value;
}
