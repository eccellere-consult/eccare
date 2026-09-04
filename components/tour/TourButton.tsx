'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { TourOverlay } from './TourOverlay';
import { TOURS } from '@/lib/tour-content';

/** Drop-in trigger for one of the three guided tours. Renders nothing but a
 *  small "Take a quick tour" link until tapped. */
export function TourButton({ tourId, label }: { tourId: keyof typeof TOURS; label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:underline"
      >
        <HelpCircle className="h-4 w-4" />
        {label ?? 'Take a quick tour'}
      </button>
      {open && <TourOverlay tour={TOURS[tourId]} onClose={() => setOpen(false)} />}
    </>
  );
}
