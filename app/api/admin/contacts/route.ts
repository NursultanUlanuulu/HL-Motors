import { apiError, readJson, requireAdmin } from '@/lib/api-server';
import { saveCloudContacts } from '@/lib/cloud-repository';

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const { contacts, previous } = await readJson(request);
    return Response.json({ contacts: await saveCloudContacts(contacts, previous) });
  } catch (error) { return apiError(error); }
}
