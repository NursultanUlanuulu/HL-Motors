import { randomUUID } from 'node:crypto';
import { apiError, readJson, requireAdmin } from '@/lib/api-server';
import { mediaBucket, validateUpload } from '@/lib/cloud-validation';
import { getSupabase } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const { type, size } = await readJson(request);
    const extension = validateUpload(type, size);
    const path = `vehicles/${randomUUID()}.${extension}`;
    const storage = getSupabase().storage.from(mediaBucket);
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error) throw error;
    return Response.json({ uploadUrl: data.signedUrl, publicUrl: storage.getPublicUrl(path).data.publicUrl });
  } catch (error) { return apiError(error); }
}
