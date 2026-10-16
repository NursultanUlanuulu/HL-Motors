import type { NextConfig } from 'next';

let mediaOrigin = '';
try { const url = new URL(process.env.SUPABASE_URL ?? ''); if (url.protocol === 'https:') mediaOrigin = url.origin; } catch { /* Local development may have no storage service. */ }

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_MEDIA_ORIGIN: mediaOrigin },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.autohaina.com', port: '', pathname: '/vehicle/**', search: '' },
      { protocol: 'https', hostname: 'images.unsplash.com', port: '', pathname: '/photo-*' },
      ...(mediaOrigin ? [{ protocol: 'https' as const, hostname: new URL(mediaOrigin).hostname, port: '', pathname: '/storage/v1/object/public/vehicle-media/**', search: '' }] : []),
    ],
    deviceSizes: [480, 640, 960, 1280, 1920], imageSizes: [96, 160, 320], qualities: [70, 85],
    formats: ['image/webp'], minimumCacheTTL: 86400,
    maximumRedirects: 0, maximumResponseBody: 20_000_000, maximumDiskCacheSize: 250_000_000,
  },
};

export default nextConfig;
