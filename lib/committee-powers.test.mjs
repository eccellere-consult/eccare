import test from 'node:test';
import assert from 'node:assert/strict';
import { powersOf, isDelegationActive, checkDelegationEnd, isCommitteeTitle, MAX_DELEGATION_DAYS } from './committee-powers.ts';

const OFF = { committeeCanManageCommittee: false, committeeCanRemoveMembers: false };
const ON = { committeeCanManageCommittee: true, committeeCanRemoveMembers: true };
const now = new Date('2026-11-17T10:00:00Z');
const later = '2026-11-25T10:00:00Z';
const earlier = '2026-11-10T10:00:00Z';

test('an ordinary resident can do nothing', () => {
  const p = powersOf({ role: 'member' }, ON, now);
  assert.deepEqual([p.canManageCommittee, p.canRemoveMembers, p.canAdminister], [false, false, false]);
});

test('committee starts with neither right (switches Off) and gets each only when its switch is On', () => {
  const off = powersOf({ role: 'committee' }, OFF, now);
  assert.deepEqual([off.canManageCommittee, off.canRemoveMembers], [false, false]);
  const one = powersOf({ role: 'committee' }, { ...OFF, committeeCanRemoveMembers: true }, now);
  assert.deepEqual([one.canManageCommittee, one.canRemoveMembers], [false, true]);
  const both = powersOf({ role: 'committee' }, ON, now);
  assert.deepEqual([both.canManageCommittee, both.canRemoveMembers], [true, true]);
  assert.equal(both.canAdminister, false, 'switches never give committee the right to change the switches');
});

test('the admin always can, whatever the switches say, and is the only one who administers', () => {
  const p = powersOf({ role: 'admin' }, OFF, now);
  assert.deepEqual([p.canManageCommittee, p.canRemoveMembers, p.canAdminister], [true, true, true]);
});

test('lent admin powers work until the end moment, then stop by themselves', () => {
  const during = powersOf({ role: 'committee', adminDelegatedUntil: later }, OFF, now);
  assert.equal(during.isActingAdmin, true);
  assert.deepEqual([during.canManageCommittee, during.canRemoveMembers], [true, true]);
  assert.equal(during.canAdminister, false, 'an acting admin cannot touch the admin, switches, or lend powers on');
  const after = powersOf({ role: 'committee', adminDelegatedUntil: earlier }, OFF, now);
  assert.equal(after.isActingAdmin, false);
  assert.deepEqual([after.canManageCommittee, after.canRemoveMembers], [false, false]);
});

test('lent powers mean nothing for someone who is no longer committee', () => {
  const p = powersOf({ role: 'member', adminDelegatedUntil: later }, OFF, now);
  assert.equal(p.isActingAdmin, false);
  assert.equal(p.canRemoveMembers, false);
});

test('isDelegationActive handles empty and junk values', () => {
  assert.equal(isDelegationActive(null, now), false);
  assert.equal(isDelegationActive(undefined, now), false);
  assert.equal(isDelegationActive('not a date', now), false);
  assert.equal(isDelegationActive(later, now), true);
});

test('an end date must be sensible: valid, at least an hour away, and not past the maximum', () => {
  assert.equal(checkDelegationEnd('garbage', now).ok, false);
  assert.equal(checkDelegationEnd('2026-11-17T10:30:00Z', now).ok, false);
  assert.equal(checkDelegationEnd('2026-11-16T10:00:00Z', now).ok, false);
  assert.equal(checkDelegationEnd(later, now).ok, true);
  const tooFar = new Date(now.getTime() + (MAX_DELEGATION_DAYS + 1) * 86400000).toISOString();
  assert.equal(checkDelegationEnd(tooFar, now).ok, false);
});

test('only the three offices are accepted as titles', () => {
  for (const t of ['president', 'secretary', 'treasurer']) assert.equal(isCommitteeTitle(t), true);
  for (const t of ['admin', 'President', '', null, undefined, 5]) assert.equal(isCommitteeTitle(t), false);
});
