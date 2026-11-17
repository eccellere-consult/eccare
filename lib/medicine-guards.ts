/**
 * Safety rules for medicines and their dose reminders.
 *
 * Medicine data is health data: a doubled medicine means an elder may be told to take a
 * dose twice. Every rule that decides "is this a duplicate?" or "is this schedule valid?"
 * lives here, as plain functions with no database access, so they can be tested on their own
 * (lib/medicine-guards.test.mjs) and reused by every route that writes medicines or reminders.
 *
 * Keep this file free of imports and of TypeScript-only runtime syntax (enums, parameter
 * properties): the test runner loads it directly.
 */

/** No real prescription needs more than this many doses a day; more means a typing mistake. */
export const MAX_DOSES_PER_DAY = 8;

/** One prescription photo never lists more medicines than this. */
export const MAX_MEDICINES_PER_PRESCRIPTION = 30;

/** Lower-case, trimmed, single spaces, no stray punctuation: "Metformin  HCl." matches "metformin hcl". */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "500 mg", "500mg" and "500 MG" are the same dose. */
export function normalizeDosage(value: string): string {
  return normalizeText(value).replace(/\s+/g, '');
}

/** What makes two medicines "the same medicine": name and strength. */
export function medicineKey(name: string, dosage: string): string {
  return `${normalizeText(name)}|${normalizeDosage(dosage)}`;
}

export type TimeSlotResult = { ok: true; slots: string[] } | { ok: false; message: string };

/** Valid "HH:MM" times (00:00-23:59), no repeats, in clock order, at most MAX_DOSES_PER_DAY. */
export function cleanTimeSlots(slots: string[]): TimeSlotResult {
  const seen = new Set<string>();
  for (const raw of slots) {
    const slot = String(raw).trim();
    const match = /^(\d{1,2}):(\d{2})$/.exec(slot);
    if (!match) return { ok: false, message: `"${slot}" is not a valid time. Use 24-hour HH:MM, for example 08:00.` };
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) {
      return { ok: false, message: `"${slot}" is not a valid time. Hours go from 00 to 23 and minutes from 00 to 59.` };
    }
    seen.add(`${String(hours).padStart(2, '0')}:${match[2]}`);
  }
  if (seen.size === 0) return { ok: false, message: 'Add at least one time for this medicine.' };
  if (seen.size > MAX_DOSES_PER_DAY) {
    return { ok: false, message: `That is ${seen.size} doses a day. Please check the times (the most allowed is ${MAX_DOSES_PER_DAY}).` };
  }
  return { ok: true, slots: [...seen].sort() };
}

interface MedicineLike {
  name: string;
  dosage: string;
  timeSlots: string[];
}

function scheduleKey(m: MedicineLike): string {
  return `${medicineKey(m.name, m.dosage)}|${[...m.timeSlots].sort().join(',')}`;
}

/** Drops a medicine that appears twice in the same list with the same name, strength and times. */
export function collapseDuplicateMedicines<T extends MedicineLike>(meds: T[]): { kept: T[]; dropped: T[] } {
  const seen = new Set<string>();
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const med of meds) {
    const key = scheduleKey(med);
    if (seen.has(key)) dropped.push(med);
    else {
      seen.add(key);
      kept.push(med);
    }
  }
  return { kept, dropped };
}

/**
 * Sorts new medicines against the ones the elder already takes:
 * - `duplicates`: same name AND strength as a medicine already on the list. Never added.
 * - `warnings`: same name, different strength. Added, but the person is told to double-check.
 */
export function splitAgainstExisting<T extends { name: string; dosage: string }>(
  candidates: T[],
  existing: { name: string; dosage: string }[],
): { fresh: T[]; duplicates: T[]; warnings: string[] } {
  const existingKeys = new Set(existing.map((e) => medicineKey(e.name, e.dosage)));
  const existingNames = new Map(existing.map((e) => [normalizeText(e.name), e.dosage]));
  const fresh: T[] = [];
  const duplicates: T[] = [];
  const warnings: string[] = [];
  for (const cand of candidates) {
    if (existingKeys.has(medicineKey(cand.name, cand.dosage))) {
      duplicates.push(cand);
      continue;
    }
    const sameNameDosage = existingNames.get(normalizeText(cand.name));
    if (sameNameDosage !== undefined) {
      warnings.push(
        `${cand.name} is already on the list as ${sameNameDosage}; this one is ${cand.dosage}. Please make sure it is not the same medicine twice.`,
      );
    }
    fresh.push(cand);
  }
  return { fresh, duplicates, warnings };
}

export interface MedicineRow extends MedicineLike {
  id: string;
  createdAt: Date;
}

/**
 * Among medicines that are all active: the later copy of a medicine with the same name,
 * strength AND times as an earlier one. These would ring the same dose twice, so the later
 * copy is the one to pause. Returns the ids to pause.
 */
export function findDuplicateMedicineIds(meds: MedicineRow[]): string[] {
  const ordered = [...meds].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  const seen = new Set<string>();
  const extra: string[] = [];
  for (const med of ordered) {
    const key = scheduleKey(med);
    if (seen.has(key)) extra.push(med.id);
    else seen.add(key);
  }
  return extra;
}

export interface ReminderRow {
  id: string;
  medicationId: string;
  scheduledAt: Date;
  status: 'pending' | 'taken' | 'missed' | 'snoozed';
  createdAt: Date;
}

const STATUS_RANK: Record<ReminderRow['status'], number> = { taken: 0, snoozed: 1, missed: 2, pending: 3 };

/**
 * Two reminders for the same medicine at the same minute are one dose shown twice. Keeps one
 * (the one the person already acted on if any, otherwise the oldest) and returns the ids of
 * the rest to remove. A "taken" record is never the one removed.
 */
export function findDuplicateReminderIds(rows: ReminderRow[]): string[] {
  const groups = new Map<string, ReminderRow[]>();
  for (const row of rows) {
    const key = `${row.medicationId}|${row.scheduledAt.getTime()}`;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  const extra: string[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    );
    for (const row of group.slice(1)) extra.push(row.id);
  }
  return extra;
}
