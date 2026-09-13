import React from 'react';

/** Shared markup for every generated app icon (manifest icons, apple-touch-icon,
 *  browser favicon) — one "EC" wordmark on the brand primary colour, rendered at
 *  whatever size the caller requests via next/og's ImageResponse. Kept to a
 *  two-letter mark with no fine detail: icons this small (down to 48px on some
 *  Android launchers) lose anything more intricate. */
export function AppIconMarkup({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0B5563',
        borderRadius: size * 0.22,
      }}
    >
      <span
        style={{
          fontSize: size * 0.46,
          fontWeight: 800,
          color: '#FFFFFF',
          letterSpacing: -size * 0.02,
          fontFamily: 'sans-serif',
        }}
      >
        EC
      </span>
    </div>
  );
}
