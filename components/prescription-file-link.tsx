import type { ReactNode } from 'react';

/** Prescription photos uploaded before the move to cloud storage were saved as "/uploads/..." files on
 *  the web server's own disk, and every deploy since has left those files behind. Their stored address
 *  now answers "404 not found", so linking to it just shows the person an error page. */
export function isLegacyUpload(filePath: string): boolean {
  return filePath.startsWith('/uploads/');
}

/** The "view the photo" link of a prescription: the real link when the photo still exists, and a
 *  plain "photo not stored" marker (not a dead link) for a legacy upload. */
export function PrescriptionFileLink({
  filePath,
  className,
  children,
}: {
  filePath: string;
  className: string;
  children: ReactNode;
}) {
  if (isLegacyUpload(filePath)) {
    const note = 'This older photo is no longer stored. Upload the prescription again to keep a copy.';
    return (
      <span className={`${className} cursor-not-allowed opacity-50`} title={note} aria-label={note} role="note">
        {children}
      </span>
    );
  }
  return (
    <a href={filePath} target="_blank" rel="noopener noreferrer" className={className} aria-label="View prescription photo">
      {children}
    </a>
  );
}
