import test from 'node:test';
import assert from 'node:assert/strict';
import { sniffImageType } from './shrink-photo.ts';

const bytes = (...b) => Uint8Array.from([...b, ...new Array(Math.max(0, 12 - b.length)).fill(0)]);

test('a JPEG is recognised by its first bytes, whatever label the phone gave it', () => {
  assert.equal(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe1)), 'image/jpeg');
});

test('a PNG is recognised by its first bytes', () => {
  assert.equal(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a)), 'image/png');
});

test('a HEIC photo (some phones) is recognised so it can be explained, not mistaken for a JPEG', () => {
  const heic = bytes(0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63);
  assert.equal(sniffImageType(heic), 'image/heic');
});

test('anything else, or too little data, is not claimed to be a picture', () => {
  assert.equal(sniffImageType(bytes(0x25, 0x50, 0x44, 0x46)), null); // a PDF
  assert.equal(sniffImageType(new Uint8Array(0)), null);
  assert.equal(sniffImageType(Uint8Array.from([0xff, 0xd8])), null);
});
