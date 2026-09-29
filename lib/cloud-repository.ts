import 'server-only';
import { getSupabase } from './supabase-server';
import { DataError, requireVersion, validateCloudCar } from './cloud-validation';
import { normalizeContacts, publicCar, type Contacts } from './site-data';
import type { Car } from './cars';

export type VehicleRow = { id: string; data: unknown; version: number };
const asCar = (row: VehicleRow): Car | null => {
  if (!row || typeof row !== 'object') return null;
  const car = publicCar(row.data);
  if (!car || car.id !== row.id || !Number.isSafeInteger(row.version) || row.version < 1) return null;
  try { return { ...validateCloudCar(car), version: row.version }; } catch { return null; }
};

export async function listCloudCars() {
  const client = getSupabase();
  const cars: Car[] = [];
  // Supabase caps each response; explicitly paginate so larger catalogues stay complete.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from('vehicles').select('id,data,version').order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
    if (error) throw error;
    for (const row of data as VehicleRow[]) {
      const car = asCar(row);
      if (car) cars.push(car);
    }
    if (data.length < 500) return cars;
  }
}

export async function cloudContacts() {
  const { data, error } = await getSupabase().from('site_settings').select('contacts').eq('id', 'main').single();
  if (error) throw error;
  return normalizeContacts(data.contacts);
}

export async function saveCloudCar(value: unknown, previousVersion?: unknown) {
  const car = validateCloudCar(value);
  const client = getSupabase();
  const query = previousVersion === undefined
    ? client.from('vehicles').insert({ id: car.id, data: car })
    : client.from('vehicles').update({ data: car }).eq('id', car.id).eq('version', requireVersion(previousVersion));
  const { data, error } = await query.select('id,data,version').maybeSingle();
  if (error?.code === '23505') throw new DataError('Объявление с этим номером уже существует.', 409);
  if (error) throw error;
  if (!data) throw new DataError('Это объявление изменилось в другой вкладке. Закройте редактор и откройте его снова.', 409);
  const saved = asCar(data as VehicleRow);
  if (!saved) throw new Error('Invalid vehicle returned by storage.');
  return saved;
}

export async function deleteCloudCar(id: unknown, version: unknown) {
  if (typeof id !== 'string' || !/^[\w-]{1,100}$/.test(id)) throw new DataError('Проверьте номер объявления.');
  const { data, error } = await getSupabase().from('vehicles').delete().eq('id', id).eq('version', requireVersion(version)).select('id');
  if (error) throw error;
  if (!data.length) throw new DataError('Объявление изменилось в другой вкладке. Повторите действие с актуальными данными.', 409);
}

export async function saveCloudContacts(value: unknown, previous?: unknown) {
  let contacts: Contacts;
  if (!previous) throw new DataError('Обновите страницу перед редактированием.');
  let original: Contacts;
  try { contacts = normalizeContacts(value); original = normalizeContacts(previous); } catch (error) { throw new DataError(error instanceof Error ? error.message : 'Проверьте контакты.'); }
  const { data, error } = await getSupabase().from('site_settings').update({ contacts }).eq('id', 'main').eq('contacts', JSON.stringify(original)).select('contacts').maybeSingle();
  if (error) throw error;
  if (!data) throw new DataError('Контакты изменились. Обновите страницу и повторите.', 409);
  return contacts;
}
