import { apiError, readJson, requireAdmin } from '@/lib/api-server';
import { DataError } from '@/lib/cloud-validation';
import { parseOption } from '@/lib/custom-options';
import { createCloudOption } from '@/lib/custom-options-server';
import { getDataMode, withSupabaseDeadline } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    if (getDataMode() === 'local') throw new DataError('Облачная база не настроена.');
    const body = await readJson(request, ['category', 'ru', 'en', 'zh']);
    let entry;
    try { entry = parseOption(body); } catch { throw new DataError('Проверьте название варианта.'); }
    return Response.json(await withSupabaseDeadline(() => createCloudOption(entry), { signal: request.signal }));
  } catch (error) { return apiError(error); }
}
