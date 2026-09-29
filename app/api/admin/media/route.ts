import { randomUUID } from 'node:crypto';
import { apiError, readJson, requireAdmin } from '@/lib/api-server';
import { mediaBucket, validateUpload } from '@/lib/cloud-validation';
import { getSupabase, withSupabaseDeadline } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    return await withSupabaseDeadline(async signal => {
      await requireAdmin(request);
      const { type, size } = await readJson(request, ['type', 'size'], { signal });
      const extension = validateUpload(type, size);
      const path = `vehicles/${randomUUID()}.${extension}`;
      const storage = getSupabase().storage.from(mediaBucket);
      const { data, error } = await storage.createSignedUploadUrl(path);
      if (error) throw error;
      return Response.json({ uploadUrl: data.signedUrl, publicUrl: storage.getPublicUrl(path).data.publicUrl });
    }, { signal: request.signal });
  } catch (error) { return apiError(error); }
}
