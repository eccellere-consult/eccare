'use client';

import { useState } from 'react';
import { MapPin, Navigation, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { communityApi } from '@/lib/community-client';
import { parseCoordinates, mapsDirectionsUrl, type LatLng } from '@/lib/geo';

/** Pins where a house is, so volunteers and service providers can find it. Two ways
 *  in: "use my current location" (stand at the house, tap) and, for anyone setting a
 *  house they aren't at, pasting a Google Maps link or "lat, lng". `house` is only
 *  passed by the committee/admin editing someone else's house; a resident pinning
 *  their own leaves it out and the server uses their own. */
export function HouseLocationEditor({
  neighborhoodId,
  house,
  current,
  onChange,
}: {
  neighborhoodId?: string;
  house?: string;
  current: LatLng | null;
  onChange: (location: LatLng | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [paste, setPaste] = useState('');

  async function save(loc: LatLng) {
    setBusy(true);
    setError('');
    try {
      await communityApi.put('/community/house-location', { neighborhoodId, house, lat: loc.lat, lng: loc.lng });
      onChange(loc);
      setPaste('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the location.');
    } finally {
      setBusy(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError('This device cannot share its location. You can paste a Google Maps link instead.');
      return;
    }
    setBusy(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        save({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setBusy(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access was blocked. Allow it for this site, or paste a Google Maps link instead.'
            : 'Could not get your location. Try again outdoors, or paste a Google Maps link instead.',
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function savePasted() {
    const loc = parseCoordinates(paste);
    if (!loc) {
      setError('Could not find a location in that. Paste a Google Maps link, or coordinates like 12.9716, 77.5946.');
      return;
    }
    save(loc);
  }

  async function remove() {
    if (!confirm('Remove the saved location for this house?')) return;
    setBusy(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (neighborhoodId) qs.set('neighborhoodId', neighborhoodId);
      if (house) qs.set('house', house);
      await communityApi.delete(`/community/house-location?${qs.toString()}`);
      onChange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the location.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
        <MapPin className="h-4 w-4 text-primary-600" />
        House location on the map
      </p>
      {current ? (
        <p className="text-sm text-success-600">
          Saved ✓{' '}
          <a href={mapsDirectionsUrl(current)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            View on Google Maps
          </a>
        </p>
      ) : (
        <p className="text-xs text-text-secondary">
          Not set yet. Pinning it helps volunteers and service providers find the house.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={useCurrentLocation} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
          {current ? 'Update with my current location' : 'Use my current location'}
        </Button>
        {current && (
          <Button type="button" size="sm" variant="outline" onClick={remove} disabled={busy}>
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        )}
      </div>
      <p className="text-xs text-text-secondary">Standing at the house? Tap the button. Otherwise paste a Google Maps link:</p>
      <div className="flex gap-2">
        <Input
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="Google Maps link or 12.9716, 77.5946"
          aria-label="Google Maps link or coordinates"
        />
        <Button type="button" size="sm" onClick={savePasted} disabled={busy || !paste.trim()}>
          Save
        </Button>
      </div>
      {error && <p className="text-sm text-danger-600">{error}</p>}
    </div>
  );
}
