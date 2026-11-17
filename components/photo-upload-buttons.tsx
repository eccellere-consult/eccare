'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Upload } from 'lucide-react';
import { WebcamDialog } from '@/components/webcam-dialog';
import { AppCameraHint } from '@/components/app-camera-hint';

/** Two explicit entry points rather than one plain file input: "Take Photo"
 *  and "Upload" (no capture — the normal file/gallery picker, still needed for
 *  reusing an existing photo). Both call the same onFile handler.
 *
 *  On a phone or tablet, "Take Photo" is an input with capture="environment" —
 *  mobile browsers skip the gallery/camera chooser and go straight to the camera.
 *  On a computer (a mouse-and-keyboard device with a webcam) that same input would
 *  only open a file picker, so "Take Photo" opens a small in-page webcam instead and
 *  passes the picture to onFile exactly as if it had been chosen from a file. */
export function PhotoUploadButtons({
  onFile,
  disabled,
  busyLabel,
  idPrefix,
}: {
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  busyLabel?: string;
  idPrefix: string;
}) {
  const uploadInput = useRef<HTMLInputElement>(null);
  const [webcam, setWebcam] = useState(false); // this device should use the in-page webcam
  const [camOpen, setCamOpen] = useState(false);

  useEffect(() => {
    try {
      const touch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
      setWebcam(!touch && Boolean(navigator.mediaDevices?.getUserMedia));
    } catch {
      setWebcam(false);
    }
  }, []);

  /** Hands a webcam picture to the same handler a file choice goes to. */
  function deliver(file: File) {
    setCamOpen(false);
    const input = uploadInput.current;
    if (!input) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const buttonClass =
    'flex cursor-pointer items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-text hover:bg-primary-50';

  return (
    <div className="flex flex-wrap gap-2">
      {webcam ? (
        <button type="button" className={buttonClass} disabled={disabled} onClick={() => setCamOpen(true)}>
          <Camera className="h-3.5 w-3.5" />
          {busyLabel ?? 'Take photo'}
        </button>
      ) : (
        <label htmlFor={`${idPrefix}-camera`} className={buttonClass}>
          <Camera className="h-3.5 w-3.5" />
          {busyLabel ?? 'Take photo'}
          <input
            id={`${idPrefix}-camera`}
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            className="hidden"
            disabled={disabled}
            onChange={onFile}
          />
        </label>
      )}
      <label htmlFor={`${idPrefix}-upload`} className={buttonClass}>
        <Upload className="h-3.5 w-3.5" />
        {busyLabel ?? 'Upload'}
        <input
          ref={uploadInput}
          id={`${idPrefix}-upload`}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          disabled={disabled}
          onChange={onFile}
        />
      </label>
      <AppCameraHint />
      {camOpen && <WebcamDialog onCapture={deliver} onClose={() => setCamOpen(false)} />}
    </div>
  );
}
