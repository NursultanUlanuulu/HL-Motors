import { apiError } from '@/lib/api-server';
import { listCustomOptions } from '@/lib/custom-options-server';
import { cloudContacts, listCloudCars } from '@/lib/cloud-repository';
import { withSupabaseDeadline } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export async function GET(request?: Request) {
  try {
    return await withSupabaseDeadline(async () => {
      const [cars, contacts, options] = await Promise.all([listCloudCars(), cloudContacts(), listCustomOptions()]);
      return Response.json({ cars, contacts, options }, { headers: { 'Cache-Control': 'no-store' } });
    }, { signal: request?.signal });
  } catch (error) { return apiError(error); }
}
