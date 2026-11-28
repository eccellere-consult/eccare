/**
 * Delivery partners: the rules that need no database, so they can be tested on their own
 * (lib/delivery-pricing.test.mjs). Rate card in, rupees out; free-time slots in, clean
 * slots out. Nothing here guesses: a missing distance or weight is treated as zero and
 * the minimum charge still applies.
 */

export const DELIVERY_CATEGORY = { value: 'delivery', label: 'Delivery partner' } as const;

export const VEHICLE_TYPES = [
  { value: 'walk', label: 'On foot' },
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'two_wheeler', label: 'Scooter / bike' },
  { value: 'auto', label: 'Auto / small van' },
] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number]['value'];

export const PARCEL_SIZES = [
  { value: 'small', label: 'Small (fits in a bag)' },
  { value: 'medium', label: 'Medium (a carton)' },
  { value: 'large', label: 'Large (needs both hands or a vehicle)' },
] as const;
export type ParcelSize = (typeof PARCEL_SIZES)[number]['value'];

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export interface RateCard {
  baseCharge: number;
  perKm: number;
  perKg: number;
  minimumCharge: number;
  roadFactor: number;
  sizeMediumSurcharge: number;
  sizeLargeSurcharge: number;
  /** Extra charge per item category, e.g. { food_restaurant: 15 }. */
  categorySurcharges: Record<string, number>;
}

export interface DeliveryQuoteInput {
  /** Straight-line distance between pickup and drop-off, in km. */
  straightKm: number;
  weightKg?: number | null;
  size?: ParcelSize | null;
  category?: string | null;
}

export interface DeliveryQuote {
  /** Estimated road distance used for the charge (straight line x road factor), 1 decimal. */
  roadKm: number;
  base: number;
  distance: number;
  weight: number;
  category: number;
  size: number;
  /** Raised to the minimum charge when the parts add up to less. */
  minimumApplied: boolean;
  /** Whole rupees. */
  total: number;
}

const positive = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);
const rupees = (n: number) => Math.round(n * 100) / 100;

/** Distance between two points on Earth in km (haversine). */
export function straightLineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The delivery charge for one order, with each part shown so the customer can see why. */
export function quoteDelivery(card: RateCard, input: DeliveryQuoteInput): DeliveryQuote {
  const roadKm = Math.round(positive(input.straightKm) * Math.max(1, positive(card.roadFactor)) * 10) / 10;
  const base = rupees(positive(card.baseCharge));
  const distance = rupees(roadKm * positive(card.perKm));
  const weight = rupees(positive(input.weightKg) * positive(card.perKg));
  const category = rupees(input.category ? positive(card.categorySurcharges[input.category]) : 0);
  const size =
    input.size === 'large'
      ? rupees(positive(card.sizeLargeSurcharge))
      : input.size === 'medium'
        ? rupees(positive(card.sizeMediumSurcharge))
        : 0;
  const sum = base + distance + weight + category + size;
  const minimum = positive(card.minimumCharge);
  const minimumApplied = sum < minimum;
  return {
    roadKm,
    base,
    distance,
    weight,
    category,
    size,
    minimumApplied,
    total: Math.round(minimumApplied ? minimum : sum),
  };
}

export interface SlotInput {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

/** "17:30" -> 1050; null when it is not a real time of day. */
export function timeToMinute(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 1050 -> "17:30" */
export function minuteToTime(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Cleans a partner's weekly free-time slots: drops impossible ones (wrong day, end before
 * start, shorter than 30 minutes), merges overlapping or touching slots on the same day and
 * sorts them. Returns an error message instead when nothing usable is left of a non-empty list.
 */
export function cleanSlots(slots: SlotInput[]): { ok: true; slots: SlotInput[] } | { ok: false; message: string } {
  const valid = slots.filter(
    (s) =>
      Number.isInteger(s.dayOfWeek) &&
      s.dayOfWeek >= 0 &&
      s.dayOfWeek <= 6 &&
      Number.isInteger(s.startMinute) &&
      Number.isInteger(s.endMinute) &&
      s.startMinute >= 0 &&
      s.endMinute <= 24 * 60 &&
      s.endMinute - s.startMinute >= 30,
  );
  if (slots.length > 0 && valid.length === 0) {
    return { ok: false, message: 'Each free-time slot must end at least 30 minutes after it starts.' };
  }
  const sorted = [...valid].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute);
  const merged: SlotInput[] = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && last.dayOfWeek === s.dayOfWeek && s.startMinute <= last.endMinute) {
      last.endMinute = Math.max(last.endMinute, s.endMinute);
    } else {
      merged.push({ ...s });
    }
  }
  return { ok: true, slots: merged };
}

/** Is the partner free at this moment by their weekly slots? `at` is read in India time. */
export function isWithinSlots(slots: SlotInput[], at: Date): boolean {
  const ist = new Date(at.getTime() + 330 * 60 * 1000);
  const day = ist.getUTCDay();
  const minute = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return slots.some((s) => s.dayOfWeek === day && minute >= s.startMinute && minute < s.endMinute);
}
