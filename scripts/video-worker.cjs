const { Pool } = require('pg');
const { S3Client, HeadObjectCommand, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { spawn } = require('node:child_process');
const { createWriteStream, createReadStream } = require('node:fs');
const fs = require('node:fs/promises');
const { pipeline } = require('node:stream/promises');
const { Transform } = require('node:stream');
const path = require('node:path');
const os = require('node:os');
const LIMIT = 500 * 1024 * 1024;
const MAX_DURATION = 1800;

function run(command, args, onProgress, timeout = 30 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    let output = '', tail = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.stdout.on('data', data => {
      output = (output + data.toString()).slice(-1024 * 1024);
      tail += data.toString();
      const lines = tail.split('\n'); tail = lines.pop();
      for (const line of lines) if (line.startsWith('out_time_us=')) onProgress?.(Number(line.slice(12)) / 1000000);
    });
    child.stderr.resume(); // Never log uploaded metadata or signed URLs.
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(output) : reject(new Error('Video conversion failed')); });
  });
}
async function probe(file) {
  return JSON.parse(await run('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,matroska,webm', '-show_streams', '-show_format', '-of', 'json', file], null, 30000));
}
function videoInfo(data) {
  const video = data.streams?.find(s => s.codec_type === 'video' && !s.disposition?.attached_pic);
  const duration = Number(data.format?.duration || video?.duration);
  if (!video || !Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION || !video.width || !video.height || video.width > 8192 || video.height > 8192 || video.width * video.height > 36000000) throw new Error('Unsupported video');
  return { video, duration };
}
function conversionArgs(input, output, data) {
  const { video } = videoInfo(data);
  // Computed after FFmpeg autorotation; no cropping or enlargement, square pixels.
  const factor = 'min(1,min(1920/max(iw*sar,ih),1080/min(iw*sar,ih)))';
  const filters = [`scale=w='max(2,trunc(iw*sar*${factor}/2)*2)':h='max(2,trunc(ih*${factor}/2)*2)'`, 'setsar=1'];
  if (['smpte2084', 'arib-std-b67'].includes(video.color_transfer)) filters.push('zscale=t=linear:npl=100', 'format=gbrpf32le', 'zscale=p=bt709', 'tonemap=tonemap=hable:desat=0', 'zscale=t=bt709:m=bt709:r=tv');
  const [n, d] = String(video.avg_frame_rate || '30/1').split('/').map(Number);
  const fps = n / d;
  if (Number.isFinite(fps) && fps > 30) filters.push('fps=30');
  filters.push('format=yuv420p');
  return ['-nostdin', '-y', '-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,matroska,webm', '-threads', '1', '-i', input,
    '-map', `0:${video.index}`, '-map', '0:a:0?', '-map_metadata', '-1', '-map_chapters', '-1', '-sn', '-dn',
    '-vf', filters.join(','), '-filter_threads', '1', '-c:v', 'libx264', '-threads', '1', '-preset', 'fast', '-crf', '22',
    '-maxrate', '6M', '-bufsize', '12M', '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-movflags', '+faststart',
    '-fs', String(LIMIT), '-progress', 'pipe:1', output];
}
async function claimJob(db) {
  await db.query("update video_jobs set status=case when attempts<3 then 'queued' else 'failed' end, error='Обработка прервана. Загрузите видео повторно.',updated_at=now() where status='processing' and updated_at<now()-interval '2 minutes'");
  const { rows } = await db.query(`update video_jobs set status='processing',attempts=attempts+1,progress=0,error=null,updated_at=now()
    where id=(select id from video_jobs where status='queued' order by created_at for update skip locked limit 1) returning *`);
  return rows[0];
}
async function processJob(db, s3, bucket, job) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'video-'));
  const input = path.join(directory, 'input'); const output = path.join(directory, 'output.mp4');
  let progress = 0;
  const heartbeat = setInterval(() => {
    void fs.writeFile('/tmp/video-worker-heartbeat', String(Date.now())).catch(() => {});
    void db.query("update video_jobs set updated_at=now(),progress=$2 where id=$1 and status='processing'", [job.id, progress]).catch(() => {});
  }, 10000);
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: job.input_key }), { abortSignal: AbortSignal.timeout(30000) });
    if (head.ContentLength !== Number(job.input_size) || head.ContentLength > LIMIT) throw new Error('Size mismatch');
    const source = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: job.input_key }), { abortSignal: AbortSignal.timeout(5 * 60 * 1000) });
    let bytes = 0;
    const bounded = new Transform({ transform(chunk, encoding, done) { bytes += chunk.length; done(bytes > LIMIT ? new Error('Too large') : null, chunk); } });
    await pipeline(source.Body, bounded, createWriteStream(input), { signal: AbortSignal.timeout(5 * 60 * 1000) });
    if (bytes !== Number(job.input_size)) throw new Error('Incomplete upload');
    const data = await probe(input); const { duration } = videoInfo(data);
    await run('ffmpeg', conversionArgs(input, output, data), seconds => { progress = Math.min(95, Math.floor(seconds / duration * 95)); });
    const converted = videoInfo(await probe(output));
    const stat = await fs.stat(output);
    if (Math.abs(converted.duration - duration) > Math.max(1, duration * .005) || stat.size >= LIMIT || converted.video.codec_name !== 'h264') throw new Error('Incomplete conversion');
    progress = 98;
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: job.output_key, Body: createReadStream(output), ContentLength: stat.size, ContentType: 'video/mp4', CacheControl: 'public, max-age=31536000, immutable' }), { abortSignal: AbortSignal.timeout(5 * 60 * 1000) });
    await db.query("update video_jobs set status='ready',progress=100,output_size=$2,error=null,updated_at=now() where id=$1", [job.id, stat.size]);
    console.log('Video ready:', job.id, bytes, stat.size);
  } catch {
    await db.query("update video_jobs set status='failed',error=$2,updated_at=now() where id=$1", [job.id, 'Не удалось обработать видео. Используйте MP4, MOV или WebM до 500 МБ и 30 минут и загрузите повторно.']);
    console.error('Video failed:', job.id);
  } finally { clearInterval(heartbeat); await fs.rm(directory, { recursive: true, force: true }); }
}
async function cleanup(db, s3, bucket) {
  await db.query("update video_jobs set status='failed',error='Загрузка не завершена. Выберите файл повторно.',updated_at=now() where status='uploading' and created_at<now()-interval '2 hours'");
  const { rows } = await db.query("select id,input_key from video_jobs where not input_deleted and status in ('ready','failed') and created_at<now()-interval '2 hours' limit 20");
  for (const row of rows) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: row.input_key }), { abortSignal: AbortSignal.timeout(30000) });
    await db.query('update video_jobs set input_deleted=true where id=$1', [row.id]);
  }
}
async function main() {
  const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
  db.on('error', () => {});
  const s3 = new S3Client({ endpoint: process.env.R2_ENDPOINT, region: 'auto', credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }, requestChecksumCalculation: 'WHEN_REQUIRED', maxAttempts: 2 });
  let lastCleanup = 0;
  for (;;) {
    try {
      await fs.writeFile('/tmp/video-worker-heartbeat', String(Date.now()));
      const job = await claimJob(db);
      if (job) await processJob(db, s3, process.env.R2_BUCKET, job);
      if (Date.now() - lastCleanup > 60000) { await cleanup(db, s3, process.env.R2_BUCKET); lastCleanup = Date.now(); }
    } catch { console.error('Video worker temporarily unavailable; retrying.'); }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
module.exports = { run, probe, videoInfo, conversionArgs, claimJob, processJob, cleanup };
if (require.main === module) main().catch(() => { process.exitCode = 1; });
