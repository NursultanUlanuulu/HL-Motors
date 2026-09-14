import { apiError, readJson, requireAdmin } from '@/lib/api-server';
import { deleteCloudCar, saveCloudCar } from '@/lib/cloud-repository';

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const { car, previousVersion } = await readJson(request);
    return Response.json({ car: await saveCloudCar(car, previousVersion) });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request) {
  try {
    await requireAdmin(request);
    const { id, version } = await readJson(request);
    await deleteCloudCar(id, version);
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
