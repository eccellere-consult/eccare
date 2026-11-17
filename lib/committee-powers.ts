/**
 * Who may do what when managing the people of a community. Pure rules, no database, so they can be
 * tested on their own (lib/committee-powers.test.mjs) and used by every route and screen alike.
 *
 *  - admin: the community's admin (a platform admin acts as one). Can do everything below, and is
 *    the only one who can switch the committee's rights, lend admin powers, or grant/remove admin.
 *  - acting admin: a committee member the admin has lent admin powers to until a date. Can do all
 *    the people-management below, but cannot touch the admin, switch rights, or lend powers on.
 *  - committee: can approve join requests and fix house numbers or names (as before). Can promote,
 *    demote, set titles, or remove residents ONLY if the admin has switched that right on.
 *  - member: nothing.
 */

export type MemberRole = 'member' | 'committee' | 'admin';

export const COMMITTEE_TITLES = ['president', 'secretary', 'treasurer'] as const;
export type CommitteeTitle = (typeof COMMITTEE_TITLES)[number];

export const TITLE_LABEL: Record<CommitteeTitle, string> = {
  president: 'President',
  secretary: 'Secretary',
  treasurer: 'Treasurer',
};

/** Longest an admin can lend their powers in one go. A short, explicit window is the point. */
export const MAX_DELEGATION_DAYS = 90;

export interface CommitteeSettings {
  committeeCanManageCommittee: boolean;
  committeeCanRemoveMembers: boolean;
}

export interface Powers {
  isAdmin: boolean;
  /** Committee member currently holding lent admin powers. */
  isActingAdmin: boolean;
  /** Make someone committee / take it away, and set President, Secretary, Treasurer. */
  canManageCommittee: boolean;
  /** Remove a resident from the community. */
  canRemoveMembers: boolean;
  /** Switch the committee's rights, lend admin powers, grant or remove admin. Real admin only. */
  canAdminister: boolean;
}

export function isDelegationActive(until: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!until) return false;
  const t = new Date(until).getTime();
  return Number.isFinite(t) && t > now.getTime();
}

export function powersOf(
  member: { role: MemberRole; adminDelegatedUntil?: Date | string | null },
  settings: CommitteeSettings,
  now: Date = new Date(),
): Powers {
  const isAdmin = member.role === 'admin';
  const isCommittee = member.role === 'committee';
  const isActingAdmin = isCommittee && isDelegationActive(member.adminDelegatedUntil, now);
  return {
    isAdmin,
    isActingAdmin,
    canManageCommittee: isAdmin || isActingAdmin || (isCommittee && settings.committeeCanManageCommittee),
    canRemoveMembers: isAdmin || isActingAdmin || (isCommittee && settings.committeeCanRemoveMembers),
    canAdminister: isAdmin,
  };
}

export function isCommitteeTitle(value: unknown): value is CommitteeTitle {
  return typeof value === 'string' && (COMMITTEE_TITLES as readonly string[]).includes(value);
}

/** Checks a requested "lend admin powers until" moment. Returns the date, or a plain-words reason. */
export function checkDelegationEnd(
  value: string,
  now: Date = new Date(),
): { ok: true; date: Date } | { ok: false; message: string } {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return { ok: false, message: 'Please choose a valid end date.' };
  if (date.getTime() <= now.getTime() + 60 * 60 * 1000) {
    return { ok: false, message: 'The end date must be at least an hour from now.' };
  }
  if (date.getTime() > now.getTime() + MAX_DELEGATION_DAYS * 24 * 60 * 60 * 1000) {
    return { ok: false, message: `Admin powers can be lent for at most ${MAX_DELEGATION_DAYS} days at a time.` };
  }
  return { ok: true, date };
}
