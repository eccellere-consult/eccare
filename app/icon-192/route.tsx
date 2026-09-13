import { ImageResponse } from 'next/og';
import { AppIconMarkup } from '@/lib/app-icon';

// Plain Node runtime (default) — this app deploys as a self-hosted `node
// server.js` on Hostinger, not Vercel Edge, so the 'edge' runtime option
// isn't the right fit here even though next/og supports both.

export async function GET() {
  return new ImageResponse(<AppIconMarkup size={192} />, { width: 192, height: 192 });
}
