// Run with: node --experimental-strip-types --test lib/delivery-pricing.test.mjs
// Tests the delivery charge and free-time slot rules (lib/delivery-pricing.ts). No database needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanSlots,
  isWithinSlots,
  minuteToTime,
  quoteDelivery,
  straightLineKm,
  timeToMinute,
  orderParcel,
  partnerEarning,
  makeHandoverCode,
  canMoveJob,
  rankPartners,
} from './delivery-pricing.ts';

const CARD = {
  baseCharge: 20,
  perKm: 8,
  perKg: 2,
  minimumCharge: 30,
  roadFactor: 1.3,
  sizeMediumSurcharge: 10,
  sizeLargeSurcharge: 30,
  partnerSharePercent: 100,
  categorySurcharges: { food_restaurant: 15 },
};

test('charge adds base, road distance, weight, category and size', () => {
  const q = quoteDelivery(CARD, { straightKm: 2, weightKg: 5, size: 'medium', category: 'food_restaurant' });
  assert.equal(q.roadKm, 2.6);
  assert.equal(q.distance, 20.8);
  assert.equal(q.weight, 10);
  assert.equal(q.category, 15);
  assert.equal(q.size, 10);
  assert.equal(q.minimumApplied, false);
  assert.equal(q.total, 76); // 20 + 20.8 + 10 + 15 + 10 = 75.8 -> 76
});

test('a short, light delivery is raised to the minimum charge', () => {
  const q = quoteDelivery(CARD, { straightKm: 0.2 });
  assert.equal(q.minimumApplied, true);
  assert.equal(q.total, 30);
});

test('missing or nonsense inputs count as zero, never as a negative charge', () => {
  const q = quoteDelivery(CARD, { straightKm: Number.NaN, weightKg: -4, size: null, category: 'unknown' });
  assert.equal(q.weight, 0);
  assert.equal(q.category, 0);
  assert.equal(q.total, 30);
});

test('a road factor below 1 never shortens the distance', () => {
  const q = quoteDelivery({ ...CARD, roadFactor: 0.5 }, { straightKm: 3 });
  assert.equal(q.roadKm, 3);
});

test('straight-line distance is about right for two points in Kochi', () => {
  const km = straightLineKm({ lat: 9.9312, lng: 76.2673 }, { lat: 9.9816, lng: 76.2999 });
  assert.ok(km > 6 && km < 7, `got ${km}`);
  assert.equal(straightLineKm({ lat: 10, lng: 76 }, { lat: 10, lng: 76 }), 0);
});

test('times convert both ways and reject impossible times', () => {
  assert.equal(timeToMinute('17:30'), 1050);
  assert.equal(timeToMinute('7:05'), 425);
  assert.equal(timeToMinute('24:00'), null);
  assert.equal(timeToMinute('noon'), null);
  assert.equal(minuteToTime(1050), '17:30');
});

test('slots: overlapping ones merge, bad ones drop, result is sorted', () => {
  const r = cleanSlots([
    { dayOfWeek: 1, startMinute: 1020, endMinute: 1140 },
    { dayOfWeek: 1, startMinute: 600, endMinute: 720 },
    { dayOfWeek: 1, startMinute: 1100, endMinute: 1200 },
    { dayOfWeek: 7, startMinute: 600, endMinute: 700 },
    { dayOfWeek: 2, startMinute: 600, endMinute: 610 },
  ]);
  assert.deepEqual(r, {
    ok: true,
    slots: [
      { dayOfWeek: 1, startMinute: 600, endMinute: 720 },
      { dayOfWeek: 1, startMinute: 1020, endMinute: 1200 },
    ],
  });
});

test('slots: a list with nothing usable is refused with a reason; an empty list is fine', () => {
  const r = cleanSlots([{ dayOfWeek: 3, startMinute: 900, endMinute: 800 }]);
  assert.equal(r.ok, false);
  assert.deepEqual(cleanSlots([]), { ok: true, slots: [] });
});

test('free right now is read in India time', () => {
  // Monday 18:00 IST = Monday 12:30 UTC
  const at = new Date(Date.UTC(2026, 10, 30, 12, 30));
  assert.equal(isWithinSlots([{ dayOfWeek: 1, startMinute: 1020, endMinute: 1140 }], at), true);
  assert.equal(isWithinSlots([{ dayOfWeek: 1, startMinute: 600, endMinute: 720 }], at), false);
});

test('order parcel: weights add up, size is the largest item, heavy orders go up a size', () => {
  assert.deepEqual(orderParcel([{ weightKg: 1, parcelSize: 'small', quantity: 2 }, { weightKg: null, parcelSize: 'medium', quantity: 1 }]), { weightKg: 2, size: 'medium' });
  assert.deepEqual(orderParcel([{ weightKg: 3, parcelSize: 'small', quantity: 2 }]), { weightKg: 6, size: 'medium' });
  assert.deepEqual(orderParcel([{ weightKg: 8, parcelSize: null, quantity: 2 }]), { weightKg: 16, size: 'large' });
  assert.deepEqual(orderParcel([]), { weightKg: 0, size: 'small' });
});

test('partner share of the charge, never above the charge', () => {
  assert.equal(partnerEarning(76, 100), 76);
  assert.equal(partnerEarning(76, 80), 60.8);
  assert.equal(partnerEarning(76, 150), 76);
  assert.equal(partnerEarning(76, -5), 0);
});

test('handover code is always 4 digits', () => {
  assert.equal(makeHandoverCode(() => 0), '0000');
  assert.equal(makeHandoverCode(() => 0.0421), '0421');
  assert.equal(makeHandoverCode(() => 0.99999), '9999');
});

test('a delivery only moves one step at a time', () => {
  assert.equal(canMoveJob('open', 'accepted'), true);
  assert.equal(canMoveJob('open', 'delivered'), false);
  assert.equal(canMoveJob('accepted', 'open'), true); // partner gives it back
  assert.equal(canMoveJob('picked_up', 'open'), false); // not once the goods are in hand
  assert.equal(canMoveJob('delivered', 'cancelled'), false);
});

test('smart dispatch: only approved, free, nearby partners who can carry it, nearest first', () => {
  const mondayEvening = new Date(Date.UTC(2026, 10, 30, 12, 30)); // Mon 18:00 IST
  const base = { verified: true, maxWeightKg: 10, radiusKm: 5, availableNow: true, slots: [], activeJobs: 0, ratingAverage: null };
  const job = { pickupLat: 9.93, pickupLng: 76.27, weightKg: 4 };
  const ranked = rankPartners(job, [
    { ...base, id: 'far', lat: 9.96, lng: 76.27 }, // ~3.3 km
    { ...base, id: 'near', lat: 9.935, lng: 76.27 }, // ~0.6 km
    { ...base, id: 'tooFar', lat: 10.1, lng: 76.27 }, // ~19 km, beyond 5 km
    { ...base, id: 'notApproved', verified: false, lat: 9.93, lng: 76.27 },
    { ...base, id: 'tooHeavy', maxWeightKg: 2, lat: 9.93, lng: 76.27 },
    { ...base, id: 'busy', activeJobs: 2, lat: 9.93, lng: 76.27 },
    { ...base, id: 'offNow', availableNow: false, slots: [{ dayOfWeek: 1, startMinute: 600, endMinute: 720 }], lat: 9.93, lng: 76.27 },
    { ...base, id: 'slotNow', availableNow: false, slots: [{ dayOfWeek: 1, startMinute: 1020, endMinute: 1140 }], lat: 9.94, lng: 76.27 },
    { ...base, id: 'unknownHome' },
  ], mondayEvening);
  assert.deepEqual(ranked.map((r) => r.id), ['near', 'slotNow', 'far', 'unknownHome']);
});

test('smart dispatch: a well-rated partner beats an unrated one at the same distance', () => {
  const now = new Date();
  const base = { verified: true, maxWeightKg: 10, radiusKm: 5, availableNow: true, slots: [], activeJobs: 0, lat: 9.935, lng: 76.27 };
  const ranked = rankPartners({ pickupLat: 9.93, pickupLng: 76.27, weightKg: 1 }, [
    { ...base, id: 'new', ratingAverage: null },
    { ...base, id: 'fiveStars', ratingAverage: 5 },
  ], now);
  assert.equal(ranked[0].id, 'fiveStars');
});
