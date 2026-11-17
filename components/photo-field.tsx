'use client';

import { useEffect, useState } from 'react';
import { ImageIcon, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { PhotoUploadButtons } from '@/components/photo-upload-buttons';
import { shrinkPhoto } from '@/lib/shrink-photo';

/**
 * "Add a photo" for an add form: Take photo / Upload, a preview, and a Remove. The picture is
 * shrunk and copied into memory the moment it is picked (so a camera photo cannot vanish while the
 * form is being filled in), and handed to the form through onChange. The form sends it after the
 * item is saved.
 */
export function PhotoField({
  idPrefix,
  file,
  onChange,
  label = 'Photo (optional)',
}: {
  idPrefix: string;
  file: File | null;
  onChange: (file: File | null) => void;
  label?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function picked(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    e.target.value = '';
    if (!chosen) return;
    setWorking(true);
    try {
      onChange(await shrinkPhoto(chosen));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-50">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Chosen photo" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-8 w-8 text-primary-600" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <PhotoUploadButtons
            idPrefix={idPrefix}
            disabled={working}
            busyLabel={working ? 'Preparing…' : undefined}
            onFile={picked}
          />
          {file && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="flex w-fit items-center gap-1 text-xs font-semibold text-text-secondary hover:text-danger-600"
            >
              <X className="h-3.5 w-3.5" /> Remove photo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
