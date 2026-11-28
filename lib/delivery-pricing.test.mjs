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
} from './delivery-pricing.ts';

const CARD = {
  baseCharge: 20,
  perKm: 8,
  perKg: 2,
  minimumCharge: 30,
  roadFactor: 1.3,
  sizeMediumSurcharge: 10,
  sizeLargeSurcharge: 30,
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
