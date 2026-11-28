import test from 'node:test';
import assert from 'node:assert/strict';
import { parseShelf, parseBox, MAX_SHELF_ITEMS } from './catalog-ai.ts';

const wrap = (items) => 'Here you go:\n' + JSON.stringify({ items }) + '\nHope that helps.';

test('keeps a clean item and a printed price', () => {
  const out = parseShelf(wrap([{ name: 'Hand sanitiser 500 ml', category: 'Health essentials', description: 'Gel for hands.', price: 180 }]));
  assert.equal(out.length, 1);
  assert.equal(out[0].price, 180);
  assert.equal(out[0].name, 'Hand sanitiser 500 ml');
});

test('a missing, zero, negative, huge or junk price becomes null, never a guess', () => {
  const out = parseShelf(wrap([
    { name: 'A', price: null },
    { name: 'B' },
    { name: 'C', price: 0 },
    { name: 'D', price: -5 },
    { name: 'E', price: 99999999 },
    { name: 'F', price: 'free' },
    { name: 'G', price: 'Rs. 49.50' },
    { name: 'H', price: '₹1,299' },
  ]));
  assert.deepEqual(out.map((i) => i.price), [null, null, null, null, null, null, 49.5, 1299]);
});

test('drops nameless rows, repeated names (any case) and non-objects', () => {
  const out = parseShelf(wrap([{ name: '' }, { name: 'Stick' }, { name: 'stick' }, 'junk', null, { name: '  Cushion  ' }]));
  assert.deepEqual(out.map((i) => i.name), ['Stick', 'Cushion']);
});

test('never returns more than the cap', () => {
  const many = Array.from({ length: MAX_SHELF_ITEMS + 10 }, (_, i) => ({ name: `Item ${i}` }));
  assert.equal(parseShelf(wrap(many)).length, MAX_SHELF_ITEMS);
});

test('garbage in gives an empty list, not an error', () => {
  assert.deepEqual(parseShelf('sorry, I cannot help'), []);
  assert.deepEqual(parseShelf('{"items": "none"}'), []);
  assert.deepEqual(parseShelf('{ broken json'), []);
  assert.deepEqual(parseShelf(JSON.stringify({ items: [] })), []);
});

test('long text is trimmed to the limits', () => {
  const [item] = parseShelf(wrap([{ name: 'x'.repeat(200), category: 'c'.repeat(200), description: 'd'.repeat(500) }]));
  assert.equal(item.name.length, 60);
  assert.equal(item.category.length, 60);
  assert.equal(item.description.length, 200);
});

test('keeps a sensible box, in fractions or on the 0 to 1000 scale', () => {
  assert.deepEqual(parseBox([0.1, 0.2, 0.35, 0.6]), [0.1, 0.2, 0.35, 0.6]);
  assert.deepEqual(parseBox([100, 200, 350, 600]), [0.1, 0.2, 0.35, 0.6]);
  const out = parseShelf(wrap([{ name: 'Stick', box: [0.1, 0.2, 0.35, 0.6] }, { name: 'List line', box: null }]));
  assert.deepEqual(out.map((i) => i.box), [[0.1, 0.2, 0.35, 0.6], null]);
});

test('a missing, inverted, too-thin or junk box becomes null', () => {
  for (const bad of [undefined, null, 'left', [0.1, 0.2, 0.3], [0.5, 0.2, 0.1, 0.6], [0.1, 0.2, 0.11, 0.6], [-0.1, 0, 0.5, 0.5], [0, 0, 5000, 5000], [0.1, 'a', 0.5, 0.5]]) {
    assert.equal(parseBox(bad), null);
  }
});
