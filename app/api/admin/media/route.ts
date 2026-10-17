import { randomUUID } from 'node:crypto';
import { apiError, readJson, requireAdmin } from '@/lib/api-server';
import { mediaBucket, validateUpload } from '@/lib/cloud-validation';
import { getSupabase, withSupabaseDeadline } from '@/lib/supabase-server';
import { r2Enabled, signR2Upload } from '@/lib/r2-storage';

export async function POST(request: Request) {
  try {
    return await withSupabaseDeadline(async signal => {
      await requireAdmin(request);
      const { type, size } = await readJson(request, ['type', 'size'], { signal });
      const extension = validateUpload(type, size);
      const path = `vehicles/${randomUUID()}.${extension}`;
      if (r2Enabled()) return Response.json(await signR2Upload(path, type as string, size as number));
      const storage = getSupabase().storage.from(mediaBucket);
      const { data, error } = await storage.createSignedUploadUrl(path);
      if (error) throw error;
      return Response.json({ uploadUrl: data.signedUrl, publicUrl: storage.getPublicUrl(path).data.publicUrl });
    }, { signal: request.signal });
  } catch (error) { return apiError(error); }
}
