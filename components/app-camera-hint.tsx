'use client';

import { useEffect, useState } from 'react';

/** Shown only inside the EC Android app (its web view identifies itself as "ECApp"). Until the
 *  app is rebuilt without the Camera permission it declares, the phone must have Camera allowed for
 *  EC in Settings, otherwise the web view's photo pickers do nothing. A static hint is the only
 *  safe way to tell: the web page cannot see that permission. */
export function AppCameraHint() {
  const [inApp, setInApp] = useState(false);
  useEffect(() => {
    try {
      setInApp(/ECApp/i.test(navigator.userAgent));
    } catch {
      setInApp(false);
    }
  }, []);
  if (!inApp) return null;
  return (
    <p className="max-w-xs text-xs text-text-secondary">
      Photo button not opening? On your phone go to Settings → Apps → EC → Permissions → Camera, choose Allow, then open EC again.
    </p>
  );
}
