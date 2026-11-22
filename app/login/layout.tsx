import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site-url';

// The sign-in page is the front door of eccare.in ("/" sends visitors here). This tells search
// engines its one true address, and gives the link a name and picture when it is shared in
// WhatsApp or by e-mail. The picture is the existing EC app icon (app/icon-512).
const TITLE = 'EC — Just Easy.';
const DESCRIPTION = 'A calm, senior-friendly care companion for elders and their families.';

export const metadata: Metadata = {
  alternates: { canonical: `${SITE_URL}/login` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/login`,
    siteName: 'EC',
    type: 'website',
    images: [{ url: `${SITE_URL}/icon-512`, width: 512, height: 512, alt: 'EC' }],
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
    images: [`${SITE_URL}/icon-512`],
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
