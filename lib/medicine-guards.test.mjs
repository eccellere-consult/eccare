// Run with: node --experimental-strip-types --test lib/medicine-guards.test.mjs
// Tests the medicine safety rules (lib/medicine-guards.ts). No database needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanTimeSlots,
  collapseDuplicateMedicines,
  findDuplicateMedicineIds,
  findDuplicateReminderIds,
  medicineKey,
  splitAgainstExisting,
} from './medicine-guards.ts';

test('same medicine is recognised however it is typed', () => {
  assert.equal(medicineKey('Metformin  HCl.', '500 mg'), medicineKey('metformin hcl', '500MG'));
  assert.notEqual(medicineKey('Metformin', '500mg'), medicineKey('Metformin', '850mg'));
});

test('time slots: valid, sorted, no repeats', () => {
  assert.deepEqual(cleanTimeSlots(['20:00', '8:00', '08:00']), { ok: true, slots: ['08:00', '20:00'] });
});

test('time slots: bad times and too many doses are refused with a plain message', () => {
  assert.equal(cleanTimeSlots(['25:00']).ok, false);
  assert.equal(cleanTimeSlots(['08:61']).ok, false);
  assert.equal(cleanTimeSlots(['morning']).ok, false);
  assert.equal(cleanTimeSlots([]).ok, false);
  const nine = Array.from({ length: 9 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`);
  assert.equal(cleanTimeSlots(nine).ok, false);
});

test('the same medicine typed twice on one prescription becomes one', () => {
  const a = { name: 'Amlodipine', dosage: '5mg', timeSlots: ['08:00'] };
  const b = { name: 'amlodipine', dosage: '5 mg', timeSlots: ['08:00'] };
  const c = { name: 'Amlodipine', dosage: '5mg', timeSlots: ['20:00'] }; // a different schedule is kept
  const { kept, dropped } = collapseDuplicateMedicines([a, b, c]);
  assert.deepEqual(kept, [a, c]);
  assert.deepEqual(dropped, [b]);
});

test('a medicine already on the list is never added again; a different strength is a warning', () => {
  const existing = [{ name: 'Metformin', dosage: '500mg' }];
  const { fresh, duplicates, warnings } = splitAgainstExisting(
    [
      { name: 'metformin', dosage: '500 mg' },
      { name: 'Metformin', dosage: '850mg' },
      { name: 'Aspirin', dosage: '75mg' },
    ],
    existing,
  );
  assert.deepEqual(duplicates.map((m) => m.dosage), ['500 mg']);
  assert.deepEqual(fresh.map((m) => m.name), ['Metformin', 'Aspirin']);
  assert.equal(warnings.length, 1);
});

test('an exact copy of an older active medicine is the one to pause', () => {
  const day = (n) => new Date(Date.UTC(2026, 10, n));
  const meds = [
    { id: 'old', name: 'Aspirin', dosage: '75mg', timeSlots: ['08:00'], createdAt: day(1) },
    { id: 'copy', name: 'Aspirin', dosage: '75 mg', timeSlots: ['08:00'], createdAt: day(5) },
    { id: 'night', name: 'Aspirin', dosage: '75mg', timeSlots: ['21:00'], createdAt: day(6) }, // different times: legitimate
  ];
  assert.deepEqual(findDuplicateMedicineIds(meds), ['copy']);
});

test('two reminders for the same dose: one stays, a taken one is never the one removed', () => {
  const at = new Date(Date.UTC(2026, 10, 17, 2, 30));
  const row = (id, status, created) => ({ id, medicationId: 'm1', scheduledAt: at, status, createdAt: new Date(created) });
  assert.deepEqual(findDuplicateReminderIds([row('a', 'pending', 1), row('b', 'pending', 2)]), ['b']);
  assert.deepEqual(findDuplicateReminderIds([row('a', 'pending', 1), row('b', 'taken', 2)]), ['a']);
  // different medicine or different minute is not a duplicate
  const other = { ...row('c', 'pending', 3), medicationId: 'm2' };
  const later = { ...row('d', 'pending', 4), scheduledAt: new Date(at.getTime() + 60_000) };
  assert.deepEqual(findDuplicateReminderIds([row('a', 'pending', 1), other, later]), []);
});

test('a day of 30 identical copies collapses to one', () => {
  const at = new Date(Date.UTC(2026, 10, 17, 2, 30));
  const rows = Array.from({ length: 30 }, (_, i) => ({
    id: `r${i}`,
    medicationId: 'm1',
    scheduledAt: at,
    status: 'pending',
    createdAt: new Date(i),
  }));
  assert.equal(findDuplicateReminderIds(rows).length, 29);
});
