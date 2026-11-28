// Emergency card: the few facts a doctor or ambulance crew needs at once.
// Pure (no imports) so both the API and the screens can use it.

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export interface EmergencyCard {
  bloodGroup: string | null;
  allergies: string | null;
  medicalConditions: string | null;
  implantsDevices: string | null;
  emergencyNotes: string | null;
}

/** Older profiles typed the blood group freely ("o +ve", "B positive"); read it as one of the 8. */
export function normaliseBloodGroup(raw: string | null | undefined): BloodGroup | null {
  if (!raw) return null;
  const s = raw
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[−–]/g, '-')
    .replace(/POSITIVE|POS|\+VE/g, '+')
    .replace(/NEGATIVE|NEG|-VE/g, '-');
  const m = s.match(/^(AB|A|B|O)([+-])$/);
  return m ? (`${m[1]}${m[2]}` as BloodGroup) : null;
}

/** True when there is anything on the card worth showing. */
export function hasEmergencyCard(c: Partial<EmergencyCard> | null | undefined): boolean {
  if (!c) return false;
  return Boolean(c.bloodGroup || c.allergies || c.medicalConditions || c.implantsDevices || c.emergencyNotes);
}
