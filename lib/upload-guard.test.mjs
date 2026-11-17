import test from 'node:test';
import assert from 'node:assert/strict';
import { sniffUploadType, describeUploadError } from './upload-guard.ts';

test('a JPEG is accepted by its first bytes even if the phone labelled it oddly', () => {
  assert.equal(sniffUploadType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'image/jpeg');
});

test('a PNG is accepted by its first bytes', () => {
  assert.equal(sniffUploadType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d])), 'image/png');
});

test('anything else (a document, a HEIC photo, an empty file) is refused', () => {
  assert.equal(sniffUploadType(Uint8Array.from([0x25, 0x50, 0x44, 0x46])), null);
  assert.equal(sniffUploadType(Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70])), null);
  assert.equal(sniffUploadType(new Uint8Array(0)), null);
});

test('a failed upload always gets a readable reason, even from an error with no message', () => {
  assert.equal(describeUploadError({ name: 'InternalError', $metadata: { httpStatusCode: 500 } }), 'InternalError, HTTP 500');
  assert.equal(describeUploadError(new Error('boom')), 'Error, boom');
  assert.equal(describeUploadError(null), 'unknown error');
});

test('a very long reason is cut short', () => {
  assert.ok(describeUploadError(new Error('x'.repeat(500))).length <= 160);
});
