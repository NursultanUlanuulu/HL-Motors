import 'server-only';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DataError } from './cloud-validation';

export function r2Enabled() { return !!(process.env.R2_ENDPOINT || process.env.R2_BUCKET || process.env.MEDIA_PUBLIC_URL || process.env.R2_ACCESS_KEY_ID || process.env.R2_SECRET_ACCESS_KEY); }

export async function signR2Upload(path: string, type: string, size: number) {
  const { R2_ENDPOINT: endpoint, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey, R2_BUCKET: bucket, MEDIA_PUBLIC_URL: mediaUrl } = process.env;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !mediaUrl) throw new DataError('Хранилище файлов на сервере не настроено.', 503);
  const origin = new URL(mediaUrl);
  const api = new URL(endpoint);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || !['', '/'].includes(origin.pathname)
    || api.protocol !== 'https:' || !api.hostname.endsWith('.r2.cloudflarestorage.com') || api.username || api.password) throw new Error('Invalid media configuration.');
  const client = new S3Client({ endpoint, region: 'auto', credentials: { accessKeyId, secretAccessKey }, maxAttempts: 1, requestChecksumCalculation: 'WHEN_REQUIRED' });
  try {
    const cacheControl = 'public, max-age=31536000, immutable';
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: path, ContentType: type, ContentLength: size, CacheControl: cacheControl }), {
      expiresIn: type.startsWith('video/') ? 3600 : 300, signableHeaders: new Set(['content-type', 'content-length', 'cache-control']),
    });
    return { uploadUrl, publicUrl: `${origin.origin}/${path}`, raw: true, headers: { 'Content-Type': type, 'Cache-Control': cacheControl } };
  } finally { client.destroy(); }
}
