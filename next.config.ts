import type { NextConfig } from 'next';

let mediaOrigin = '';
try { const url = new URL(process.env.SUPABASE_URL ?? ''); if (url.protocol === 'https:') mediaOrigin = url.origin; } catch { /* Local development may have no storage service. */ }
let r2Origin = '';
try { const url = new URL(process.env.MEDIA_PUBLIC_URL ?? ''); if (url.protocol === 'https:' && !url.username && !url.password) r2Origin = url.origin; } catch { /* R2 is optional for existing Supabase deployments. */ }

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: '/:path*', has: [{ type: 'host', value: 'www.firstseven-auto.com' }], destination: 'https://firstseven-auto.com/:path*', permanent: true }];
  },
  reactStrictMode: true,
  env: { NEXT_PUBLIC_MEDIA_ORIGIN: mediaOrigin, NEXT_PUBLIC_R2_ORIGIN: r2Origin },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.autohaina.com', port: '', pathname: '/vehicle/**', search: '' },
      { protocol: 'https', hostname: 'images.unsplash.com', port: '', pathname: '/photo-*' },
      ...(mediaOrigin ? [{ protocol: 'https' as const, hostname: new URL(mediaOrigin).hostname, port: '', pathname: '/storage/v1/object/public/vehicle-media/**', search: '' }] : []),
      ...(r2Origin ? [{ protocol: 'https' as const, hostname: new URL(r2Origin).hostname, port: '', pathname: '/vehicles/**', search: '' }] : []),
    ],
    deviceSizes: [480, 640, 960, 1280, 1920], imageSizes: [96, 160, 320], qualities: [70, 85],
    formats: ['image/webp'], minimumCacheTTL: 86400,
    maximumRedirects: 0, maximumResponseBody: 100 * 1024 * 1024, maximumDiskCacheSize: 250_000_000,
  },
};

export default nextConfig;
