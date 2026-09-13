'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Shared 5-star tap control + optional comment, used by every "close + rate"
 *  screen (Orders, Doctor bookings, Advisory, Property Management,
 *  Auto-booking) — see components/provider-rating-summary.tsx for the
 *  read-only display counterpart, and lib/ratings.ts for the write path this
 *  feeds into. */
export function RatingInput({
  onSubmit,
  submitLabel,
  busy,
}: {
  onSubmit: (stars: number, comment: string) => void;
  submitLabel: string;
  busy?: boolean;
}) {
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');

  const displayed = hovered || stars;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-bold text-text">Rate this experience</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStars(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            className="p-0.5"
          >
            <Star
              className={n <= displayed ? 'h-7 w-7 text-accent-600' : 'h-7 w-7 text-border'}
              fill={n <= displayed ? 'currentColor' : 'none'}
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything else to share? (optional)"
        rows={2}
        className="rounded-xl border border-border bg-surface p-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
      />
      <Button
        size="sm"
        disabled={busy || stars === 0}
        onClick={() => onSubmit(stars, comment)}
        className="w-fit"
      >
        {busy ? 'Submitting…' : submitLabel}
      </Button>
    </div>
  );
}
