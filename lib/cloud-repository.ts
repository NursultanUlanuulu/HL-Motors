import 'server-only';
import { getDataMode, getSupabase } from './supabase-server';
import { pgQuery } from './postgres';
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
  if (getDataMode() === 'postgres') {
    const { rows } = await pgQuery<VehicleRow>('select id, data, version::float8 as version from public.vehicles order by created_at desc, id');
    return rows.map(asCar).filter((car): car is Car => car !== null);
  }
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
  if (getDataMode() === 'postgres') {
    const { rows } = await pgQuery('select contacts from public.site_settings where id = $1', ['main']);
    return normalizeContacts(rows[0]?.contacts);
  }
  const { data, error } = await getSupabase().from('site_settings').select('contacts').eq('id', 'main').single();
  if (error) throw error;
  return normalizeContacts(data.contacts);
}

export async function saveCloudCar(value: unknown, previousVersion?: unknown) {
  const car = validateCloudCar(value);
  if (getDataMode() === 'postgres') {
    let rows: VehicleRow[];
    try {
      ({ rows } = previousVersion === undefined
        ? await pgQuery<VehicleRow>('insert into public.vehicles(id,data) values($1,$2::jsonb) returning id,data,version::float8 as version', [car.id, JSON.stringify(car)])
        : await pgQuery<VehicleRow>('update public.vehicles set data=$1::jsonb where id=$2 and version=$3 returning id,data,version::float8 as version', [JSON.stringify(car), car.id, requireVersion(previousVersion)]));
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new DataError('Объявление с этим номером уже существует.', 409);
      throw error;
    }
    if (!rows.length) throw new DataError('Это объявление изменилось в другой вкладке. Закройте редактор и откройте его снова.', 409);
    const saved = asCar(rows[0]);
    if (!saved) throw new Error('Invalid vehicle returned by storage.');
    return saved;
  }
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
  if (getDataMode() === 'postgres') {
    const { rowCount } = await pgQuery('delete from public.vehicles where id=$1 and version=$2 returning id', [id, requireVersion(version)]);
    if (!rowCount) throw new DataError('Объявление изменилось в другой вкладке. Повторите действие с актуальными данными.', 409);
    return;
  }
  const { data, error } = await getSupabase().from('vehicles').delete().eq('id', id).eq('version', requireVersion(version)).select('id');
  if (error) throw error;
  if (!data.length) throw new DataError('Объявление изменилось в другой вкладке. Повторите действие с актуальными данными.', 409);
}

export async function saveCloudContacts(value: unknown, previous?: unknown) {
  let contacts: Contacts;
  if (!previous) throw new DataError('Обновите страницу перед редактированием.');
  let original: Contacts;
  try { contacts = normalizeContacts(value); original = normalizeContacts(previous); } catch (error) { throw new DataError(error instanceof Error ? error.message : 'Проверьте контакты.'); }
  if (getDataMode() === 'postgres') {
    const { rowCount } = await pgQuery('update public.site_settings set contacts=$1::jsonb, updated_at=now() where id=$2 and contacts=$3::jsonb returning contacts', [JSON.stringify(contacts), 'main', JSON.stringify(original)]);
    if (!rowCount) throw new DataError('Контакты изменились. Обновите страницу и повторите.', 409);
    return contacts;
  }
  const { data, error } = await getSupabase().from('site_settings').update({ contacts }).eq('id', 'main').eq('contacts', JSON.stringify(original)).select('contacts').maybeSingle();
  if (error) throw error;
  if (!data) throw new DataError('Контакты изменились. Обновите страницу и повторите.', 409);
  return contacts;
}
