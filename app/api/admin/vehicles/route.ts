import { apiError, readJson, requireAdmin } from '@/lib/api-server';
import { deleteCloudCar, saveCloudCar } from '@/lib/cloud-repository';
import { withSupabaseDeadline } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    return await withSupabaseDeadline(async signal => {
      await requireAdmin(request);
      const { car, previousVersion } = await readJson(request, ['car', 'previousVersion'], { signal });
      return Response.json({ car: await saveCloudCar(car, previousVersion) });
    }, { signal: request.signal });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request) {
  try {
    return await withSupabaseDeadline(async signal => {
      await requireAdmin(request);
      const { id, version } = await readJson(request, ['id', 'version'], { signal });
      await deleteCloudCar(id, version);
      return Response.json({ ok: true });
    }, { signal: request.signal });
  } catch (error) { return apiError(error); }
}
