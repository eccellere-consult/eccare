import type { MetadataRoute } from 'next';

// Auto-served at /manifest.webmanifest and linked into <head> by Next.js. This
// is what Android's "Add to Home Screen" / Chrome install prompt actually reads
// for the icon and standalone display — the favicon (app/icon.tsx) is not enough
// on its own for that. iOS reads app/apple-icon.tsx instead (see its comment).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EC — Just Easy.',
    short_name: 'EC',
    description: 'A calm, senior-friendly care companion for elders and their families.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F8F7F3',
    theme_color: '#0B5563',
    icons: [
      { src: '/icon-192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-192', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
