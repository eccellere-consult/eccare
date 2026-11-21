import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORTED_LANGUAGES } from './languages.ts';
import en from './dictionaries/en.ts';
import hi from './dictionaries/hi.ts';
import kn from './dictionaries/kn.ts';
import ml from './dictionaries/ml.ts';
import ta from './dictionaries/ta.ts';
import te from './dictionaries/te.ts';

const DICTIONARIES = { en, hi, kn, ml, ta, te };
const placeholders = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

test('every language in the picker has a dictionary, and every dictionary is in the picker', () => {
  const codes = SUPPORTED_LANGUAGES.map((l) => l.code).sort();
  assert.deepEqual(codes, Object.keys(DICTIONARIES).sort());
});

test('Tamil and Telugu are offered with their own names', () => {
  const byCode = Object.fromEntries(SUPPORTED_LANGUAGES.map((l) => [l.code, l]));
  assert.equal(byCode.ta.native, 'தமிழ்');
  assert.equal(byCode.te.native, 'తెలుగు');
});

for (const [code, dict] of Object.entries(DICTIONARIES)) {
  test(`${code}: covers exactly the English keys, with no blank text`, () => {
    assert.deepEqual(Object.keys(dict).sort(), Object.keys(en).sort());
    for (const [key, value] of Object.entries(dict)) {
      assert.ok(typeof value === 'string' && value.trim().length > 0, `${code} ${key} is blank`);
    }
  });

  test(`${code}: keeps every {placeholder} the English text has`, () => {
    for (const key of Object.keys(en)) {
      assert.equal(placeholders(dict[key]), placeholders(en[key]), `${code} ${key} placeholders differ`);
    }
  });
}
