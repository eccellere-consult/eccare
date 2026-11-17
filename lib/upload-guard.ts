/**
 * Small, shared checks for photo uploads (marketplace, rentals). Kept free of any framework or
 * database code so it can be tested on its own.
 */

/** The picture's real type from its first bytes. A phone camera can label a perfectly good JPEG
 *  with an empty or odd type, so the label is never trusted. Only JPEG and PNG are accepted. */
export function sniffUploadType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  return null;
}

/** A readable reason for a failed upload. The storage library sometimes throws an error with an
 *  empty message; naming the error and the storage service's HTTP status keeps "Something went
 *  wrong" from being the only thing anyone sees. */
export function describeUploadError(err: unknown): string {
  const e = err as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } } | null;
  const status = e?.$metadata?.httpStatusCode;
  const detail = [e?.name, status ? `HTTP ${status}` : '', e?.message].filter(Boolean).join(', ') || 'unknown error';
  return detail.slice(0, 160);
}
