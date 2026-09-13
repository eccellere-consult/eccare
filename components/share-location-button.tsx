'use client';

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Same "share current location" pattern already used by
 *  app/community-registration/page.tsx and the SOS/emergency flow — a plain
 *  navigator.geolocation capture into two string fields, no map UI or
 *  geocoding (none exists anywhere in this app). Extracted here since
 *  provider registration and the provider profile-edit form both need it. */
export function ShareLocationButton({
  lat,
  onLocated,
  onError,
}: {
  lat: string;
  onLocated: (lat: string, lng: string) => void;
  onError?: (message: string) => void;
}) {
  const [locating, setLocating] = useState(false);

  function shareLocation() {
    if (!navigator.geolocation) {
      onError?.('Location sharing is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLocated(String(pos.coords.latitude), String(pos.coords.longitude));
        setLocating(false);
      },
      () => {
        onError?.('Could not get your location — you can still continue without it.');
        setLocating(false);
      },
      { timeout: 8000 },
    );
  }

  return (
    <Button type="button" variant="outline" onClick={shareLocation} disabled={locating} className="w-fit">
      <MapPin className="mr-1.5 h-4 w-4" />
      {locating ? 'Getting location…' : lat ? 'Location captured' : 'Share current location'}
    </Button>
  );
}
