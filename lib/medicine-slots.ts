// EC is India-only — medicine times are always entered and displayed in IST (UTC+5:30).
export type MedicineSlot = 'morning' | 'afternoon' | 'evening' | 'night';

export const SLOT_ORDER: MedicineSlot[] = ['morning', 'afternoon', 'evening', 'night'];

export const SLOT_META: Record<MedicineSlot, { label: string; short: string; range: string }> = {
  morning: { label: 'Morning', short: 'M', range: '4:00 AM – 11:59 AM' },
  afternoon: { label: 'Afternoon', short: 'A', range: '12:00 PM – 4:59 PM' },
  evening: { label: 'Evening', short: 'E', range: '5:00 PM – 8:59 PM' },
  night: { label: 'Night', short: 'N', range: '9:00 PM – 3:59 AM' },
};

const IST_OFFSET_MINUTES = 5 * 60 + 30;

/** Convert a medicine's intended IST HH:MM time on a given date into the correct UTC instant. */
export function localTimeToUtcDate(dateStr: string, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCMinutes(hours * 60 + minutes - IST_OFFSET_MINUTES);
  return date;
}

/** Minutes since midnight IST for a stored UTC instant. */
export function istMinutesOfDay(date: Date): number {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  return ((utcMinutes + IST_OFFSET_MINUTES) % 1440 + 1440) % 1440;
}

export function getSlotForMinutes(minutesOfDay: number): MedicineSlot {
  const h = Math.floor(minutesOfDay / 60);
  if (h >= 4 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

export function getSlotForDate(date: Date): MedicineSlot {
  return getSlotForMinutes(istMinutesOfDay(date));
}

/** Today's date ("YYYY-MM-DD") as of IST — avoids the UTC date rolling over ~5.5h early. */
export function todayIST(): string {
  const istMs = Date.now() + IST_OFFSET_MINUTES * 60 * 1000;
  return new Date(istMs).toISOString().split('T')[0];
}

/** e.g. "8:00 AM" in IST, independent of the viewer's device timezone. */
export function formatIstTime(date: Date): string {
  const minutes = istMinutesOfDay(date);
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}
