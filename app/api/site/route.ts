import { apiError } from '@/lib/api-server';
import { cloudContacts, listCloudCars } from '@/lib/cloud-repository';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const [cars, contacts] = await Promise.all([listCloudCars(), cloudContacts()]);
    return Response.json({ cars, contacts }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
