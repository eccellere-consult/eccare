/**
 * Makes a phone photo small enough to upload and load quickly, in the person's own browser,
 * before it is sent. A modern phone camera produces 3-12 MB pictures; shoppers on a slow
 * connection should never have to download those. Anything that cannot be shrunk (an old
 * browser, an unusual file) is sent as it was - this never blocks an upload.
 *
 * It also reads the picture into memory straight away. A photo taken with the camera on an Android
 * phone is a temporary file that can change or disappear before it is sent a minute later (while the
 * shopkeeper types the price), which made the upload fail with nothing useful to say. Once it is in
 * memory, nothing outside the page can take it away.
 */

/** The picture's real type from its first bytes. Camera files sometimes arrive with an empty type. */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp') return 'image/heic';
  return null;
}

async function intoMemory(file: File): Promise<File> {
  const buffer = await file.arrayBuffer();
  const type = sniffImageType(new Uint8Array(buffer, 0, Math.min(12, buffer.byteLength))) || file.type || 'image/jpeg';
  return new File([buffer], file.name || 'photo.jpg', { type });
}

/** Decodes a picture to something drawable, trying the fast route first and an <img> as the fallback. */
async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  try {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close?.() };
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  }
}

export async function shrinkPhoto(original: File, maxEdge = 1600, quality = 0.85): Promise<File> {
  let file = original;
  try {
    file = await intoMemory(original);
  } catch {
    // Could not read it now; carry on with the file as given.
  }
  const isPicture = file.type === 'image/jpeg' || file.type === 'image/png';
  // Small enough already: leave the picture exactly as taken.
  if (file.size < 600 * 1024 && isPicture) return file;
  try {
    const decoded = await decode(file);
    const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      decoded.done();
      return file;
    }
    // A white ground so a transparent PNG does not turn black as a JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(decoded.source, 0, 0, width, height);
    decoded.done();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || (blob.size >= file.size && isPicture)) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
