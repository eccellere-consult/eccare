/**
 * Cuts one product's own picture out of a bigger photo (a shelf, a counter), in the person's own
 * browser. The place is given as fractions of the photo: [left, top, right, bottom]. A little room
 * is left around the product so it is not cut tight, and the picture is made square-ish enough to
 * sit well in a catalogue card. Returns null when the browser cannot do it; the item is then saved
 * without a picture, exactly as before.
 */
export type PhotoBox = [number, number, number, number];

/** The pixel rectangle to cut, with padding, kept inside the photo. Pure, so it can be tested. */
export function cropRect(width: number, height: number, box: PhotoBox, pad = 0.08): { x: number; y: number; w: number; h: number } {
  const [l, t, r, b] = box;
  const padX = (r - l) * pad;
  const padY = (b - t) * pad;
  const x1 = Math.max(0, Math.floor((l - padX) * width));
  const y1 = Math.max(0, Math.floor((t - padY) * height));
  const x2 = Math.min(width, Math.ceil((r + padX) * width));
  const y2 = Math.min(height, Math.ceil((b + padY) * height));
  return { x: x1, y: y1, w: Math.max(1, x2 - x1), h: Math.max(1, y2 - y1) };
}

export async function cropPhoto(source: ImageBitmap | HTMLImageElement, box: PhotoBox, name: string, maxEdge = 1000): Promise<File | null> {
  try {
    const fullW = 'naturalWidth' in source ? source.naturalWidth : source.width;
    const fullH = 'naturalHeight' in source ? source.naturalHeight : source.height;
    const { x, y, w, h } = cropRect(fullW, fullH, box);
    // A cut smaller than this is too blurry to help a buyer.
    if (w < 80 || h < 80) return null;
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, x, y, w, h, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!blob) return null;
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
  } catch {
    return null;
  }
}

/** Opens a photo file as something that can be drawn from, several times. */
export async function openPhoto(file: File): Promise<{ source: ImageBitmap | HTMLImageElement; close: () => void } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, close: () => bitmap.close?.() };
  } catch {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await img.decode();
      return { source: img, close: () => URL.revokeObjectURL(url) };
    } catch {
      return null;
    }
  }
}
