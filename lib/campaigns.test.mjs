import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceFor, cleanVideoUrl, effectiveStatus, isShowing, liveWindow, pickAd, missingBeforePay, PLACEMENTS, PLACEMENT_INFO } from './campaigns.ts';

test('price is pro-rata from the 30-day price, rounded up to the rupee', () => {
  assert.equal(priceFor(499, 30), 499);
  assert.equal(priceFor(499, 7), 117); // 116.43 -> 117
  assert.equal(priceFor(999, 15), 500); // 499.5 -> 500
  assert.equal(priceFor(0, 30), 0);
  assert.equal(priceFor(499, 0), 0);
});

test('only https YouTube / Instagram / Facebook video links', () => {
  assert.equal(cleanVideoUrl('https://youtu.be/abc123'), 'https://youtu.be/abc123');
  assert.ok(cleanVideoUrl('https://www.youtube.com/watch?v=abc'));
  assert.ok(cleanVideoUrl('https://www.instagram.com/reel/xyz/'));
  assert.equal(cleanVideoUrl('http://youtu.be/abc'), null);
  assert.equal(cleanVideoUrl('https://evil.example/video'), null);
  assert.equal(cleanVideoUrl('javascript:alert(1)'), null);
  assert.equal(cleanVideoUrl(''), null);
});

test('a live campaign past its end has ended, and is not shown', () => {
  const now = new Date('2026-12-10T00:00:00Z');
  const { startsAt, endsAt } = liveWindow(new Date('2026-12-01T00:00:00Z'), 7);
  assert.equal(endsAt.toISOString(), '2026-12-08T00:00:00.000Z');
  assert.equal(effectiveStatus({ status: 'live', endsAt }, now), 'ended');
  assert.equal(isShowing({ status: 'live', startsAt, endsAt }, now), false);
  assert.equal(isShowing({ status: 'live', startsAt, endsAt }, new Date('2026-12-05T00:00:00Z')), true);
  assert.equal(isShowing({ status: 'in_review', startsAt, endsAt }, new Date('2026-12-05T00:00:00Z')), false);
});

test('one ad slot rotates fairly by the hour', () => {
  const ads = [{ id: 'b' }, { id: 'a' }, { id: 'c' }];
  const h = (n) => new Date(n * 3_600_000);
  assert.deepEqual([pickAd(ads, h(0)).id, pickAd(ads, h(1)).id, pickAd(ads, h(2)).id, pickAd(ads, h(3)).id], ['a', 'b', 'c', 'a']);
  assert.equal(pickAd([], h(0)), null);
});

test('title, offer and phone are needed before paying', () => {
  assert.deepEqual(missingBeforePay({ title: 'Diwali offer', offerText: '20% off home cleaning', contactPhone: '98460 98113' }), []);
  assert.equal(missingBeforePay({ title: '', offerText: '', contactPhone: '123' }).length, 3);
});

test('every placement has a label and a default price', () => {
  for (const p of PLACEMENTS) assert.ok(PLACEMENT_INFO[p].label && PLACEMENT_INFO[p].defaultPricePer30Days > 0, p);
});
