/** Small location helpers shared by the forms and the routes. */

export interface LatLng {
  lat: number;
  lng: number;
}

const valid = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

/** Pulls a position out of whatever someone pastes: "12.9716, 77.5946", or a Google
 *  Maps link (…/@12.9716,77.5946,17z, …?q=12.97,77.59, …!3d12.97!4d77.59, ll=…).
 *  Lets a committee member set a house they aren't standing at. Returns null when
 *  nothing usable is found — never guesses. */
export function parseCoordinates(text: string): LatLng | null {
  const t = text.trim();
  const patterns: RegExp[] = [
    /@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/, // …/@lat,lng,zoom
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/, // place data in long links
    /[?&](?:q|ll|query|destination)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/, // ?q=lat,lng
    /^\(?\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*\)?$/, // plain "lat, lng"
  ];
  for (const re of patterns) {
    const m = re.exec(t);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (valid(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

export function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return typeof lat === 'number' && typeof lng === 'number' && valid(lat, lng);
}

/** Google Maps turn-by-turn to the spot — opens the Maps app on a phone. */
export function mapsDirectionsUrl(loc: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`;
}
