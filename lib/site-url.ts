/** The public address search engines should use. Fixed on purpose: robots.txt and the sitemap
 *  must always point at the real site, never at a preview or local address that APP_URL may hold. */
export const SITE_URL = 'https://eccare.in';

/** Pages anyone can open without signing in and that are worth showing in search.
 *  "/" is left out because it sends visitors straight to /login, so /login is the front door.
 *  Left out on purpose: /showcase (out of date), /geriatric-care and /services/safety (not ready),
 *  and everything behind a sign-in. Add a path here when a new public page goes live. */
export const PUBLIC_PAGES: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' | 'yearly' }[] = [
  { path: '/login', priority: 1, changeFrequency: 'monthly' },
  { path: '/demo', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/pricing', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/partner', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/community-registration', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/newsletter', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/csae-policy', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/delete-account', priority: 0.2, changeFrequency: 'yearly' },
];
