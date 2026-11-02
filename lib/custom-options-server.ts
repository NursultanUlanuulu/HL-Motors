import 'server-only';
import { pgQuery } from './postgres';
import { getDataMode, getSupabase } from './supabase-server';
import { type CustomOption, parseOption, existingValue, customValue } from './custom-options';

export async function listCustomOptions(): Promise<CustomOption[]> {
  if (getDataMode() === 'postgres') {
    const result = await pgQuery('select category,ru,en,zh from public.vehicle_options order by category,ru');
    return result.rows.map(parseOption);
  }
  const result: CustomOption[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await getSupabase().from('vehicle_options').select('category,ru,en,zh').order('category').order('ru').range(offset, offset + 499);
    if (error) throw error;
    result.push(...data.map(parseOption));
    if (data.length < 500) return result;
  }
}
export async function createCloudOption(entry: CustomOption) {
  const before = await listCustomOptions();
  const previous = existingValue(before, entry.category, entry.ru);
  if (previous) return { value: previous, options: before };
  if (getDataMode() === 'postgres') {
    await pgQuery('insert into public.vehicle_options(category,ru,en,zh) values($1,$2,$3,$4) on conflict do nothing', [entry.category, entry.ru, entry.en, entry.zh]);
  } else {
    const { error } = await getSupabase().from('vehicle_options').insert(entry);
    if (error && error.code !== '23505') throw error;
  }
  const options = await listCustomOptions();
  return { options, value: existingValue(options, entry.category, entry.ru) || customValue(entry) };
}
