import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-url';

// Served at /robots.txt. Search engines may read the public pages; everything behind a
// sign-in, the API, uploaded photos and one-time links (password reset, payment) is kept out.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/elder',
          '/family',
          '/provider',
          '/community/',
          '/services',
          '/rentals',
          '/pay/',
          '/uploads/',
          '/reset-password',
          '/forgot-password',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
