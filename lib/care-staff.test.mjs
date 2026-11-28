import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aadhaarLast4,
  missingForSubmit,
  recheckDate,
  isListed,
  staffRole,
  STAFF_ROLES,
  namesMatch,
  parseCertificateRead,
  certificateNote,
} from './care-staff.ts';

test('only the last 4 Aadhaar digits are kept', () => {
  assert.equal(aadhaarLast4('1234'), '1234');
  assert.equal(aadhaarLast4('1234 5678 9012'), '9012');
  assert.equal(aadhaarLast4('xxxx-xxxx-4321'), '4321'); // copied from a masked Aadhaar
  assert.equal(aadhaarLast4('12345'), null);
  assert.equal(aadhaarLast4(''), null);
  assert.equal(aadhaarLast4(null), null);
});

test('a nurse needs a certificate, a cook does not', () => {
  const base = { personName: 'ANITHA K', aadhaarLast4: '1234', documents: [{ kind: 'id_proof' }], rates: [{ proposedAmount: 800 }] };
  assert.deepEqual(missingForSubmit({ ...base, role: 'cook' }), []);
  const nurse = missingForSubmit({ ...base, role: 'home_visit_nurse' });
  assert.equal(nurse.length, 1);
  assert.match(nurse[0], /certificate/);
  assert.deepEqual(missingForSubmit({ ...base, role: 'home_visit_nurse', documents: [{ kind: 'id_proof' }, { kind: 'certificate' }] }), []);
});

test('nothing filled in lists everything that is missing', () => {
  const missing = missingForSubmit({ personName: '', role: '', aadhaarLast4: null, documents: [], rates: [] });
  assert.equal(missing.length, 5);
});

test('a zero rate does not count', () => {
  const m = missingForSubmit({ personName: 'RAVI', role: 'security_guard', aadhaarLast4: '9999', documents: [{ kind: 'id_proof' }], rates: [{ proposedAmount: 0 }] });
  assert.deepEqual(m, ['At least one rate']);
});

test('the re-check date never passes a document expiry', () => {
  const approved = new Date('2026-12-01T00:00:00Z');
  assert.equal(recheckDate(approved, 12, []).toISOString().slice(0, 10), '2027-12-01');
  const expiry = new Date('2027-03-31T00:00:00Z');
  assert.equal(recheckDate(approved, 12, [expiry, null]).toISOString().slice(0, 10), '2027-03-31');
});

test('listed only when approved, in date and with a rate', () => {
  const now = new Date('2027-01-01T00:00:00Z');
  const future = new Date('2027-06-01T00:00:00Z');
  const past = new Date('2026-06-01T00:00:00Z');
  assert.equal(isListed({ status: 'approved', verifiedUntil: future, approvedRateCount: 1 }, now), true);
  assert.equal(isListed({ status: 'approved', verifiedUntil: past, approvedRateCount: 1 }, now), false);
  assert.equal(isListed({ status: 'approved', verifiedUntil: future, approvedRateCount: 0 }, now), false);
  assert.equal(isListed({ status: 'submitted', verifiedUntil: future, approvedRateCount: 1 }, now), false);
});

test('names match across spellings and initials, but not different people', () => {
  assert.equal(namesMatch('ANITHA K. NAIR', 'Anitha Nair'), true);
  assert.equal(namesMatch('Anitha', 'ANITHA K NAIR'), true);
  assert.equal(namesMatch('Sunitha Nair', 'Anitha Nair'), false);
  assert.equal(namesMatch('', 'Anitha'), false);
});

test('the certificate reader never invents a date or a name', () => {
  const r = parseCertificateRead('Sure: {"name":"ANITHA NAIR","qualification":"GNM","expiresOn":"31/03/2027","looksLikeCertificate":true}');
  assert.equal(r.name, 'ANITHA NAIR');
  assert.equal(r.expiresOn, null); // not in YYYY-MM-DD: dropped, not guessed
  assert.equal(parseCertificateRead('no json here'), null);
  const ok = parseCertificateRead('{"name":"","expiresOn":"2027-03-31","looksLikeCertificate":true}');
  assert.equal(ok.name, null);
  assert.equal(ok.expiresOn, '2027-03-31');
  assert.match(certificateNote(ok, 'RAVI'), /No name could be read/);
  assert.match(certificateNote({ ...ok, name: 'SUNIL' }, 'RAVI KUMAR'), /does NOT match/);
});

test('every role has a section and a rate unit', () => {
  for (const r of STAFF_ROLES) {
    assert.ok(['on_visit', 'full_time', 'part_time'].includes(r.engagement), r.value);
    assert.ok(['visit', 'hour', 'day', 'month'].includes(r.defaultUnit), r.value);
  }
  assert.equal(staffRole('nope'), undefined);
});
