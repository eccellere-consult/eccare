'use client';

import { useEffect, useState } from 'react';
import { ImageIcon, Sparkles, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { PhotoUploadButtons } from '@/components/photo-upload-buttons';
import { shrinkPhoto } from '@/lib/shrink-photo';

export interface PhotoDraft {
  title: string;
  description: string;
}

/**
 * "Add a photo" for an add form: Take photo / Upload, a preview, and a Remove. The picture is
 * shrunk and copied into memory the moment it is picked (so a camera photo cannot vanish while the
 * form is being filled in), and handed to the form through onChange. The form sends it after the
 * item is saved.
 *
 * With `draftKind` set, the photo helper also looks at the picture and hands a suggested title and
 * description to `onDraft`; the form fills only boxes the person has not typed in, and the person
 * always checks the words. A price is never suggested.
 */
export function PhotoField({
  idPrefix,
  file,
  onChange,
  label = 'Photo (optional)',
  draftKind,
  draftMode,
  onDraft,
}: {
  idPrefix: string;
  file: File | null;
  onChange: (file: File | null) => void;
  label?: string;
  draftKind?: 'marketplace' | 'rental';
  draftMode?: string;
  onDraft?: (draft: PhotoDraft) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function askHelper(small: File) {
    if (!draftKind || !onDraft) return;
    setDrafting(true);
    setNote('');
    try {
      const body = new FormData();
      body.append('file', small);
      body.append('kind', draftKind);
      if (draftMode) body.append('mode', draftMode);
      const res = await fetch('/api/v1/listing-draft', { method: 'POST', credentials: 'include', body });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: { draft: PhotoDraft | null; reason: string | null };
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) throw new Error(json?.error?.message || 'The photo helper is not available. Please type the details.');
      if (json.data?.draft) {
        onDraft(json.data.draft);
        setNote('The photo helper filled in the empty boxes. Please check the words before you post.');
      } else if (json.data?.reason) {
        setNote(json.data.reason);
      }
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'The photo helper is not available. Please type the details.');
    } finally {
      setDrafting(false);
    }
  }

  async function picked(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    e.target.value = '';
    if (!chosen) return;
    setWorking(true);
    setNote('');
    let small: File;
    try {
      small = await shrinkPhoto(chosen);
      onChange(small);
    } finally {
      setWorking(false);
    }
    await askHelper(small);
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
            disabled={working || drafting}
            busyLabel={working ? 'Preparing…' : drafting ? 'Reading photo…' : undefined}
            onFile={picked}
          />
          {file && (
            <button
              type="button"
              onClick={() => { onChange(null); setNote(''); }}
              className="flex w-fit items-center gap-1 text-xs font-semibold text-text-secondary hover:text-danger-600"
            >
              <X className="h-3.5 w-3.5" /> Remove photo
            </button>
          )}
        </div>
      </div>
      {drafting && (
        <p className="flex items-center gap-2 text-sm font-semibold text-primary-600">
          <Sparkles className="h-4 w-4" /> Looking at your photo…
        </p>
      )}
      {note && !drafting && <p className="text-sm text-text-secondary">{note}</p>}
    </div>
  );
}
