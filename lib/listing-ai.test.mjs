import test from 'node:test';
import assert from 'node:assert/strict';
import { parseListingDraft, buildListingPrompt } from './listing-ai.ts';

test('a normal answer is read into a title and description', () => {
  const d = parseListingDraft('{"title":"Foldable wheelchair","description":"Blue frame, black seat."}', 'marketplace');
  assert.deepEqual(d, { title: 'Foldable wheelchair', description: 'Blue frame, black seat.' });
});

test('extra words around the answer are ignored', () => {
  const d = parseListingDraft('Here you go:\n```json\n{"title":"Steel almirah","description":"Grey."}\n```', 'marketplace');
  assert.equal(d.title, 'Steel almirah');
});

test('an answer that is not usable gives an empty draft, never an error', () => {
  assert.deepEqual(parseListingDraft('sorry, cannot', 'marketplace'), { title: '', description: '' });
  assert.deepEqual(parseListingDraft('{"title": 5}', 'rental'), { title: '', description: '' });
  assert.deepEqual(parseListingDraft('{broken', 'rental'), { title: '', description: '' });
});

test('long answers are cut to the length the form allows', () => {
  const long = 'x'.repeat(500);
  const m = parseListingDraft(JSON.stringify({ title: long, description: long }), 'marketplace');
  assert.equal(m.title.length, 60);
  assert.equal(m.description.length, 200);
  const r = parseListingDraft(JSON.stringify({ title: long, description: long }), 'rental');
  assert.equal(r.title.length, 70);
  assert.equal(r.description.length, 240);
});

test('the prompts forbid guessing a price, and the rental prompt forbids senior-friendly claims', () => {
  assert.match(buildListingPrompt('marketplace', 'sell'), /No price/);
  assert.match(buildListingPrompt('marketplace', 'sell'), /Do not invent/);
  assert.match(buildListingPrompt('marketplace', 'wanted'), /LOOKING FOR/);
  assert.match(buildListingPrompt('rental'), /Do not say it is safe, accessible or suitable for senior citizens/);
  assert.match(buildListingPrompt('rental'), /rent, deposit/);
});
