import { randomUUID } from 'node:crypto';
import { apiError, readJson, requireAdmin } from '@/lib/api-server';
import { DataError, validateUpload } from '@/lib/cloud-validation';
import { pgQuery } from '@/lib/postgres';
import { r2Enabled, signR2Upload } from '@/lib/r2-storage';

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    if (!process.env.DATABASE_URL || !r2Enabled()) throw new DataError('Обработка видео на сервере не настроена.', 503);
    const { action, id, type, size, filename } = await readJson(request, ['action', 'id', 'type', 'size', 'filename']);
    if (action === 'create') {
      const extension = validateUpload(type, size);
      if (typeof type !== 'string' || !type.startsWith('video/') || typeof filename !== 'string' || !filename.trim() || filename.length > 255) throw new DataError('Неподдерживаемый файл.');
      const jobId = randomUUID();
      const key = `video-input/${jobId}.${extension}`;
      const signed = await signR2Upload(key, type, size as number);
      // Bound normal admin upload bursts before allocating a processing job.
      const result = await pgQuery(`with admission as (select pg_advisory_xact_lock(2076582761, 3))
        insert into video_jobs(id,input_key,output_key,filename,input_size)
        select $1,$2,$3,$4,$5 from admission
        where (select count(*) from video_jobs where status in ('uploading','queued','processing') and created_at > now()-interval '2 hours') < 10 returning id`,
      [jobId, key, `vehicles/video-${jobId}.mp4`, filename.trim(), size]);
      if (!result.rows.length) throw new DataError('Очередь видео заполнена. Дождитесь завершения обработки.', 429);
      return Response.json({ uploadUrl: signed.uploadUrl, headers: signed.headers, id: jobId });
    }
    if (action === 'recent') {
      const { rows } = await pgQuery(`select id,filename,status,progress,error,output_key from video_jobs where dismissed_at is null and created_at > now()-interval '7 days' order by created_at desc limit 20`);
      return Response.json({ jobs: rows.map(publicJob) });
    }
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) throw new DataError('Некорректный запрос.');
    if (action === 'dismiss') {
      const { rows } = await pgQuery("update video_jobs set dismissed_at=now() where id=$1 and status in ('ready','failed') returning id", [id]);
      if (!rows.length) throw new DataError('Дождитесь завершения обработки видео.', 409);
      return Response.json({ removed: true });
    }
    if (action === 'start') await pgQuery("update video_jobs set status='queued',updated_at=now() where id=$1 and status='uploading'", [id]);
    else if (action !== 'status') throw new DataError('Некорректный запрос.');
    const { rows } = await pgQuery('select id,filename,status,progress,error,output_key from video_jobs where id=$1', [id]);
    if (!rows.length) throw new DataError('Видео не найдено.', 404);
    return Response.json(publicJob(rows[0]));
  } catch (error) { return apiError(error); }
}

function publicJob(row: Record<string, unknown>) {
  return { id: row.id, filename: row.filename, status: row.status, progress: row.progress, error: row.error,
    ...(row.status === 'ready' ? { publicUrl: `${new URL(process.env.MEDIA_PUBLIC_URL!).origin}/${row.output_key}` } : {}) };
}
