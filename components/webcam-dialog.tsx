'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * A small in-page camera for computers and laptops. On a phone, "Take photo" hands over to the
 * phone's own camera app, but a computer's browser would only open a file picker, which looks as
 * if the camera button is broken. This opens the computer's webcam instead, shows a live view, and
 * returns the picture as a JPEG file. If the camera cannot be opened (no webcam, permission
 * refused), it says so and the person can close this and use Upload.
 */
export function WebcamDialog({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
          setReady(true);
        }
      } catch {
        setError('The camera could not be opened. Please allow the camera in your browser, or close this and use Upload.');
      }
    })();
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, []);

  function snap() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('The picture could not be taken. Please try again, or use Upload.');
          return;
        }
        onCapture(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.9,
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Take a photo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="flex w-full max-w-lg flex-col gap-3 rounded-2xl bg-surface p-4">
        <div className="flex items-center justify-between">
          <p className="font-bold text-text">Take a photo</p>
          <button type="button" onClick={onClose} aria-label="Close camera" className="rounded-lg p-1 text-text-secondary hover:bg-primary-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        {error ? (
          <p className="text-sm text-danger-600">{error}</p>
        ) : (
          <video ref={video} playsInline muted className="aspect-video w-full rounded-xl bg-black object-cover" />
        )}
        <div className="flex gap-2">
          {!error && (
            <Button type="button" onClick={snap} disabled={!ready}>
              <Camera className="h-4 w-4" /> Take picture
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            {error ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </div>
    </div>
  );
}
