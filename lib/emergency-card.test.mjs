import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOOD_GROUPS, normaliseBloodGroup, hasEmergencyCard } from './emergency-card.ts';

test('the 8 blood groups', () => {
  assert.deepEqual([...BLOOD_GROUPS], ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
});

test('reads old free-typed blood groups', () => {
  for (const [raw, want] of [
    ['O+', 'O+'], ['o +ve', 'O+'], ['B positive', 'B+'], ['AB-', 'AB-'], ['ab neg', 'AB-'],
    ['A −', 'A-'], ['O-ve', 'O-'], ['Bpos', 'B+'], ['', null], [null, null], ['unknown', null], ['C+', null],
  ]) assert.equal(normaliseBloodGroup(raw), want, String(raw));
});

test('a card with nothing on it is empty', () => {
  assert.equal(hasEmergencyCard(null), false);
  assert.equal(hasEmergencyCard({ bloodGroup: null, allergies: '' }), false);
  assert.equal(hasEmergencyCard({ allergies: 'Penicillin' }), true);
});
