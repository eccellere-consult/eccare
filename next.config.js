/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Hostinger shared hosting enforces a low per-account process cap (CloudLinux LVE).
  // Next.js's default build worker pool forks enough processes during "Collecting page
  // data" to hit that cap (EAGAIN). Limiting to a single worker avoids the fork storm.
  experimental: {
    cpus: 1,
    workerThreads: false,
  },

  async headers() {
    return [
      // Next.js stamps `Cache-Control: s-maxage=31536000` (ONE YEAR) on statically
      // prerendered pages. That's safe on a CDN that understands Next's own cache
      // invalidation (Vercel), but Hostinger's generic CDN just honours it literally:
      // each edge node independently caches the HTML for a year.
      //
      // The failure mode this caused was severe and very hard to diagnose: different
      // edges held different-aged copies of the HTML, so the *same URL* returned
      // several different builds depending on which edge served the request. Worse,
      // stale HTML references content-hashed JS chunks (`page-<hash>.js`) that no
      // longer exist after a redeploy, so those requests 404 and the page renders
      // broken — intermittently, per-edge, which looks exactly like a flaky server.
      //
      // Fix: HTML must always be revalidated against the origin. Never let a shared
      // cache serve HTML without checking first.
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
      // Build assets are content-hashed, so their URL changes whenever the content
      // does. These are genuinely safe (and desirable) to cache forever — this rule
      // comes second so it overrides the catch-all above for this path.
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
