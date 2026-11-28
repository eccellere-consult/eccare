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
  /** The delivery partner's share of the charge, 0-100 (the rest is EC's). */
  partnerSharePercent: number;
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

const SIZE_RANK: Record<ParcelSize, number> = { small: 0, medium: 1, large: 2 };

/**
 * Weight and parcel size of a whole order from its items. Weight adds up (unknown weights
 * count as zero). Size is the largest item's size, raised to medium above 5 kg and to large
 * above 15 kg, because a heavy order needs a bigger bag whatever the items say.
 */
export function orderParcel(
  items: { weightKg?: number | null; parcelSize?: string | null; quantity: number }[],
): { weightKg: number; size: ParcelSize } {
  let weightKg = 0;
  let rank = 0;
  for (const i of items) {
    weightKg += positive(i.weightKg) * Math.max(0, i.quantity);
    const r = SIZE_RANK[i.parcelSize as ParcelSize];
    if (r !== undefined) rank = Math.max(rank, r);
  }
  if (weightKg > 15) rank = 2;
  else if (weightKg > 5) rank = Math.max(rank, 1);
  const size = (Object.keys(SIZE_RANK) as ParcelSize[]).find((k) => SIZE_RANK[k] === rank)!;
  return { weightKg: Math.round(weightKg * 100) / 100, size };
}

/** The partner's part of a delivery charge (the rest is EC's), in rupees and paise. */
export function partnerEarning(charge: number, partnerSharePercent: number): number {
  const share = Math.min(100, positive(partnerSharePercent));
  return Math.round(positive(charge) * share) / 100;
}

/** A 4-digit handover code the customer reads out at the door. */
export function makeHandoverCode(random: () => number = Math.random): string {
  return String(Math.floor(random() * 10000)).padStart(4, '0');
}

export type JobStatus = 'open' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';

/** The only moves a delivery can make, one step at a time. */
const NEXT: Record<JobStatus, JobStatus[]> = {
  open: ['accepted', 'cancelled'],
  accepted: ['picked_up', 'open', 'cancelled'],
  picked_up: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};
export function canMoveJob(from: JobStatus, to: JobStatus): boolean {
  return NEXT[from].includes(to);
}

export interface DispatchCandidate {
  id: string;
  verified: boolean;
  maxWeightKg: number;
  radiusKm: number;
  availableNow: boolean;
  slots: SlotInput[];
  /** The partner's home location from their provider profile, when they shared it. */
  lat?: number | null;
  lng?: number | null;
  /** Deliveries they are already carrying (accepted or picked up). */
  activeJobs: number;
  /** Average delivery rating 1-5, or null before their first rating. */
  ratingAverage: number | null;
}

export interface DispatchJob {
  pickupLat?: number | null;
  pickupLng?: number | null;
  weightKg: number;
}

export const MAX_ACTIVE_JOBS = 2;

/**
 * Smart dispatch: which partners should be offered this delivery, best first.
 * A partner qualifies when EC has approved them, they are free now (switch or weekly slot),
 * the order is not heavier than they carry, they hold fewer than MAX_ACTIVE_JOBS deliveries,
 * and the shop is within their distance (when both locations are known).
 * Best = nearest, then a good rating, then the fewest deliveries already in hand. A partner
 * whose location is unknown is placed as if at the edge of their distance.
 */
export function rankPartners(
  job: DispatchJob,
  candidates: DispatchCandidate[],
  now: Date,
): { id: string; distanceKm: number | null; score: number }[] {
  const pickupKnown = typeof job.pickupLat === 'number' && typeof job.pickupLng === 'number';
  const out: { id: string; distanceKm: number | null; score: number }[] = [];
  for (const c of candidates) {
    if (!c.verified) continue;
    if (!(c.availableNow || isWithinSlots(c.slots, now))) continue;
    if (positive(job.weightKg) > c.maxWeightKg) continue;
    if (c.activeJobs >= MAX_ACTIVE_JOBS) continue;
    const homeKnown = typeof c.lat === 'number' && typeof c.lng === 'number';
    const distanceKm =
      pickupKnown && homeKnown
        ? Math.round(straightLineKm({ lat: c.lat!, lng: c.lng! }, { lat: job.pickupLat!, lng: job.pickupLng! }) * 10) / 10
        : null;
    if (distanceKm !== null && distanceKm > c.radiusKm) continue;
    const ratingBonus = c.ratingAverage === null ? 0 : (c.ratingAverage - 3) * 0.5;
    const score = Math.round(((distanceKm ?? c.radiusKm) - ratingBonus + c.activeJobs) * 100) / 100;
    out.push({ id: c.id, distanceKm, score });
  }
  return out.sort((a, b) => a.score - b.score);
}

/** Is the partner free at this moment by their weekly slots? `at` is read in India time. */
export function isWithinSlots(slots: SlotInput[], at: Date): boolean {
  const ist = new Date(at.getTime() + 330 * 60 * 1000);
  const day = ist.getUTCDay();
  const minute = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return slots.some((s) => s.dayOfWeek === day && minute >= s.startMinute && minute < s.endMinute);
}
