'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Prescription photos uploaded before the move to cloud storage were saved as "/uploads/..." files on
 *  the web server's own disk, and every deploy since has left those files behind. Their stored address
 *  now answers "404 not found", so there is no photo to show for them. */
export function isLegacyUpload(filePath: string): boolean {
  return filePath.startsWith('/uploads/');
}

const LEGACY_NOTE = 'This older photo is no longer stored. Upload the prescription again to keep a copy.';

/**
 * Tap to see a prescription photo, big, in a pop-up on the same page.
 *
 * It used to be a link out to the storage service's own address in a new tab. Inside the phone app
 * (which shows this website in a page) a link like that did nothing, so the prescriptions looked
 * dead. This opens on EC's own address (/api/v1/health/prescriptions/<id>/file), which works in the
 * app and in a browser, and for an older photo that no longer exists it says so instead of
 * looking broken.
 */
export function PrescriptionFileLink({
  id,
  filePath,
  title,
  className,
  children,
}: {
  id: string;
  filePath: string;
  title?: string;
  className: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const legacy = isLegacyUpload(filePath);
  const show = () => {
    setFailed(false);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={show}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            show();
          }
        }}
        className={`${className} cursor-pointer text-left`}
        aria-label={title ? `View prescription: ${title}` : 'View prescription photo'}
      >
        {children}
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title ?? 'Prescription photo'}
          className="fixed inset-0 z-50 flex flex-col bg-black/85"
          onClick={() => setOpen(false)}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3" onClick={(e) => e.stopPropagation()}>
            <p className="min-w-0 truncate text-base font-bold text-white">{title ?? 'Prescription'}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
            {legacy || failed ? (
              <p className="max-w-sm rounded-xl bg-white p-5 text-center text-base font-semibold text-text">
                {legacy ? LEGACY_NOTE : 'The photo could not be loaded right now. Please try again in a moment.'}
              </p>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/v1/health/prescriptions/${id}/file`}
                alt={title ? `Prescription: ${title}` : 'Prescription photo'}
                className="max-h-full max-w-full rounded-lg bg-white object-contain"
                onError={() => setFailed(true)}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
