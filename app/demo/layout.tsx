import type { Metadata } from 'next';

// What shows when the link is shared in WhatsApp or by e-mail.
export const metadata: Metadata = {
  title: 'Try EC — a demo for elders',
  description: 'See how EC keeps elders safe and connected with their family and neighbours. No sign-up, no password — everything is sample data.',
  openGraph: {
    title: 'Try EC — a demo for elders',
    description: 'See how EC keeps elders safe and connected with their family and neighbours. No sign-up, no password.',
    type: 'website',
  },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
