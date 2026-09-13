import { ImageResponse } from 'next/og';
import { AppIconMarkup } from '@/lib/app-icon';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(<AppIconMarkup size={32} />, size);
}
