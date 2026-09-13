import { ImageResponse } from 'next/og';
import { AppIconMarkup } from '@/lib/app-icon';

// Plain Node runtime (default) — see app/icon-192/route.tsx for why.

export async function GET() {
  return new ImageResponse(<AppIconMarkup size={512} />, { width: 512, height: 512 });
}
