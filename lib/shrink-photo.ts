/**
 * Makes a phone photo small enough to upload and load quickly, in the person's own browser,
 * before it is sent. A modern phone camera produces 3-8 MB pictures; shoppers on a slow
 * connection should never have to download those. Anything that cannot be shrunk (an old
 * browser, an unusual file) is sent as it was - this never blocks an upload.
 */
export async function shrinkPhoto(file: File, maxEdge = 1600, quality = 0.85): Promise<File> {
  // Small enough already: leave the picture exactly as taken.
  if (file.size < 600 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // A white ground so a transparent PNG does not turn black as a JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
