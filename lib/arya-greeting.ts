// What Arya says when she is opened. Kept apart from the UI so the wording is easy to
// review and tune. English only for now, matching the rest of the voice pipeline
// (see the note at the top of lib/speech.ts).

const HONORIFICS = /^(mr|mrs|ms|miss|dr|shri|shree|smt|sri|prof|late)\.?$/i;

/** "Dr. ramesh kumar" → "Ramesh". Arya addresses elders by first name + "ji". */
export function firstNameFor(fullName?: string | null): string | null {
  const parts = (fullName ?? '').trim().split(/\s+/).filter((p) => p && !HONORIFICS.test(p));
  const first = parts[0];
  if (!first) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Time of day in India, regardless of where the device clock is set. */
export function istPartOfDay(now: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(now),
  ) % 24;
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
}

/** The formal first-time greeting and introduction. */
export function aryaIntroduction(fullName?: string | null, now?: Date): string {
  const name = firstNameFor(fullName);
  return [
    name ? `Namaste, ${name} ji.` : 'Namaste.',
    `Good ${istPartOfDay(now)}.`,
    'I am Arya, your personal care companion here at EC.',
    'I am here to help you stay close to your family, look after your health, and find your way around the app.',
    'How may I help you today?',
  ].join(' ');
}

/** Shorter welcome when the elder opens Arya again in the same visit. */
export function aryaWelcomeBack(fullName?: string | null): string {
  const name = firstNameFor(fullName);
  return name ? `I am listening, ${name} ji. How may I help you?` : 'I am listening. How may I help you?';
}
