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
};

module.exports = nextConfig;
