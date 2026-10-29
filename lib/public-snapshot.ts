import 'server-only';
import { cache } from 'react';
import { connection } from 'next/server';
import { cloudContacts, listCloudCars } from './cloud-repository';
import { getDataMode, withSupabaseDeadline } from './supabase-server';
import { cars } from './cars';
import { defaultContacts } from './site-data';

// Share the public snapshot between metadata and rendering within one request.
// Never cache it across requests: admin changes must be visible immediately.
export const getPublicSnapshot = cache(async () => {
  await connection();
  if (getDataMode() === 'local') return { cars, contacts: defaultContacts };
  return withSupabaseDeadline(async () => {
    const [cars, contacts] = await Promise.all([listCloudCars(), cloudContacts()]);
    return { cars, contacts };
  });
});
