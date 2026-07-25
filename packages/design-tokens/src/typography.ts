export const fontSizeScale = {
  large: 1,
  xlarge: 1.2,
  xxlarge: 1.4,
} as const;

export type FontSizePreference = keyof typeof fontSizeScale;

export const typography = {
  caption: { size: 18, lineHeight: 26, weight: '400' as const },
  body: { size: 20, lineHeight: 30, weight: '400' as const },
  bodyLarge: { size: 24, lineHeight: 34, weight: '400' as const },
  button: { size: 22, lineHeight: 28, weight: '700' as const },
  subtitle: { size: 24, lineHeight: 32, weight: '600' as const },
  h3: { size: 28, lineHeight: 36, weight: '700' as const },
  h2: { size: 32, lineHeight: 40, weight: '700' as const },
  h1: { size: 36, lineHeight: 44, weight: '700' as const },
} as const;

export const fontFamily = {
  primary: '"Inter", "Noto Sans", system-ui, -apple-system, sans-serif',
} as const;

export function scaledSize(
  baseSize: number,
  preference: FontSizePreference = 'xlarge',
): number {
  return Math.round(baseSize * fontSizeScale[preference]);
}
