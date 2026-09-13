'use client';

import { Camera, Upload } from 'lucide-react';

/** Two explicit entry points rather than one plain file input: "Take Photo"
 *  (capture="environment" — mobile browsers skip the gallery/camera chooser
 *  and go straight to the camera) and "Upload" (no capture — the normal
 *  file/gallery picker, still needed for reusing an existing photo). Both
 *  call the same onFile handler; only the input's own `capture` attribute
 *  differs. */
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
  return (
    <div className="flex flex-wrap gap-2">
      <label
        htmlFor={`${idPrefix}-camera`}
        className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-text hover:bg-primary-50"
      >
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
      <label
        htmlFor={`${idPrefix}-upload`}
        className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-text hover:bg-primary-50"
      >
        <Upload className="h-3.5 w-3.5" />
        {busyLabel ?? 'Upload'}
        <input
          id={`${idPrefix}-upload`}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          disabled={disabled}
          onChange={onFile}
        />
      </label>
    </div>
  );
}
