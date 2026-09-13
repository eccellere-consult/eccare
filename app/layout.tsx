import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EC — Just Easy.',
  description: 'A calm, senior-friendly care companion for elders and their families.',
  // iOS Safari ignores the web manifest for "Add to Home Screen" — it reads
  // apple-touch-icon (app/apple-icon.tsx) for the icon and this block for
  // standalone (no browser chrome) behaviour. Android/Chrome reads
  // app/manifest.ts instead for both.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'EC',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B5563',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
