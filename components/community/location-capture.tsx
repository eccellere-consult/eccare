'use client';

import { useState } from 'react';
import { Check, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

/** One button that asks the phone where it is. For someone standing at their own front door:
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
    <div className="flex flex-col gap-2">
      <p className="text-sm text-text-secondary">{labels.help}</p>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={capture}
        disabled={busy}
        aria-live="polite"
        className={cn('w-full', value && 'border-success-600 bg-success-50 text-success-600 hover:bg-success-50')}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : value ? <Check className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
        {busy ? labels.finding : value ? labels.saved : labels.button}
      </Button>
      {failed && <p className="text-sm text-danger-600">{labels.failed}</p>}
    </div>
  );
}
