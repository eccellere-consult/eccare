'use client';

import { useState } from 'react';
import { Check, Loader2, MapPin } from 'lucide-react';

export interface CapturedLocation {
  lat: number;
  lng: number;
}

export interface LocationCaptureLabels {
  button: string;
  help: string;
  finding: string;
  saved: string;
  failed: string;
}

/** One big button that asks the phone where it is. For someone standing at their own front door:
 *  tap, allow, done. Reports the position upward; it does not save anything by itself, so it can
 *  be used before an account is a member of anything (the join page sends it with the request). */
export function LocationCapture({
  value,
  onChange,
  labels,
}: {
  value: CapturedLocation | null;
  onChange: (location: CapturedLocation | null) => void;
  labels: LocationCaptureLabels;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function capture() {
    if (!navigator.geolocation) {
      setFailed(true);
      return;
    }
    setBusy(true);
    setFailed(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setBusy(false);
        setFailed(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-base text-text-secondary">{labels.help}</p>
      <button
        type="button"
        onClick={capture}
        disabled={busy}
        aria-live="polite"
        className={
          value
            ? 'flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl border-2 border-success-600 bg-success-50 px-4 py-3 text-lg font-bold text-success-600'
            : 'flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl border-2 border-primary-600 bg-surface px-4 py-3 text-lg font-bold text-primary-900 hover:bg-primary-50 disabled:opacity-60'
        }
      >
        {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : value ? <Check className="h-6 w-6" /> : <MapPin className="h-6 w-6" />}
        {busy ? labels.finding : value ? labels.saved : labels.button}
      </button>
      {failed && <p className="text-base text-danger-600">{labels.failed}</p>}
    </div>
  );
}
