import { apiError, readJson, requireAdmin } from '@/lib/api-server';
import { saveCloudContacts } from '@/lib/cloud-repository';
import { withSupabaseDeadline } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    return await withSupabaseDeadline(async signal => {
      await requireAdmin(request);
      const { contacts, previous } = await readJson(request, ['contacts', 'previous'], { signal });
      return Response.json({ contacts: await saveCloudContacts(contacts, previous) });
    }, { signal: request.signal });
  } catch (error) { return apiError(error); }
}
