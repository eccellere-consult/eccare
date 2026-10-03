/** The age rule: 60 and over is an elder, under 60 is a family member (caregiver).
 *  Pure and dependency-free so the registration form (client) and the server
 *  routes apply exactly the same maths. */

export const ELDER_AGE = 60;
export const MIN_REGISTRATION_AGE = 18;
const MAX_AGE = 120;

/** Parses "YYYY-MM-DD" into a real calendar date, or null. Rejects things like
 *  31 February that Date would silently roll over. */
export function parseDateOfBirth(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/** Whole years completed on `now`. Calendar-based (a birthday counts on the day),
 *  using UTC dates throughout so the server's and browser's time zones can't
 *  disagree by a day. */
export function ageOn(dob: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export type DobCheck = { ok: true; dob: Date; age: number } | { ok: false; reason: 'invalid' | 'future' | 'too_young' | 'too_old' };

/** Validates a date-of-birth string for registration. */
export function checkDateOfBirth(value: string, now: Date = new Date()): DobCheck {
  const dob = parseDateOfBirth(value);
  if (!dob) return { ok: false, reason: 'invalid' };
  if (dob.getTime() > now.getTime()) return { ok: false, reason: 'future' };
  const age = ageOn(dob, now);
  if (age < MIN_REGISTRATION_AGE) return { ok: false, reason: 'too_young' };
  if (age > MAX_AGE) return { ok: false, reason: 'too_old' };
  return { ok: true, dob, age };
}

export function roleForAge(age: number): 'elder' | 'caregiver' {
  return age >= ELDER_AGE ? 'elder' : 'caregiver';
}

export const DOB_ERROR_MESSAGES: Record<Exclude<DobCheck, { ok: true }>['reason'], string> = {
  invalid: 'Please enter a valid date of birth.',
  future: 'Date of birth cannot be in the future.',
  too_young: `You must be at least ${MIN_REGISTRATION_AGE} to register.`,
  too_old: 'Please check the date of birth — it looks too far in the past.',
};

/** Caregiver features are a hard check on age: allowed when the person is under 60,
 *  or an admin has granted an exception. An account with no date of birth yet
 *  (created before this rule) is allowed — it's asked for one, and the rule applies
 *  from the moment one is entered. */
export function isCaregiverEligible(user: {
  dateOfBirth?: Date | null;
  caregiverException?: boolean | null;
}, now: Date = new Date()): boolean {
  if (!user.dateOfBirth) return true;
  if (user.caregiverException) return true;
  return ageOn(user.dateOfBirth, now) < ELDER_AGE;
}
