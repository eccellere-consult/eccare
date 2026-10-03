'use client';

import { Label } from '@/components/ui/label';
import { DateOfBirthField } from '@/components/dob-field';

/** Date of birth on a profile page. Accounts that pre-date the age rule have none
 *  and can add it here (once); after that it's shown read-only, because if a
 *  person could edit it the age rule could be dodged by simply changing it. Only
 *  an admin can correct it (Admin > Users). */
export function ProfileDobField({
  locked,
  value,
  onChange,
  labels,
}: {
  /** The date already on record (YYYY-MM-DD), or null when none is. */
  locked: string | null;
  value: string;
  onChange: (iso: string) => void;
  labels: { label: string; day: string; month: string; year: string; locked: string; addPrompt: string };
}) {
  if (locked) {
    const formatted = new Date(`${locked}T00:00:00Z`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    return (
      <div className="flex flex-col gap-1">
        <Label>{labels.label}</Label>
        <p className="text-base font-semibold text-text">{formatted}</p>
        <p className="text-xs text-text-secondary">{labels.locked}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Label>{labels.label}</Label>
      <DateOfBirthField id="p-dob" value={value} onChange={onChange} labels={labels} />
      <p className="text-xs text-text-secondary">{labels.addPrompt}</p>
    </div>
  );
}
