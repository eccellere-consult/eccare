'use client';

import { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import type { Tour } from '@/lib/tour-content';

const PADDING = 8;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Lightweight, self-built spotlight tour — no third-party tour library. Finds
 *  each step's target element by id, cuts a highlighted hole for it in a dimmed
 *  backdrop, and places a callout with Back/Next/Skip beside it. Re-measures on
 *  scroll/resize so the spotlight tracks the real element instead of drifting.
 *  A step whose target isn't on screen (not yet rendered, e.g. a role-gated
 *  field) is skipped automatically rather than showing a spotlight on nothing. */
export function TourOverlay({ tour, onClose }: { tour: Tour; onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [lang, setLang] = useState<'en' | 'ml'>('en');
  const [rect, setRect] = useState<Rect | null>(null);

  const step = tour.steps[stepIndex];

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.selector);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - PADDING, left: r.left - PADDING, width: r.width + PADDING * 2, height: r.height + PADDING * 2 });
    // Instant, not smooth — an animated scroll mid-transition briefly leaves the
    // spotlight and the Back/Next buttons out of sync with their real on-screen
    // position while it's still moving, which can turn a normal double-tap into
    // a click landing on the wrong control once the scroll finishes elsewhere.
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ behavior: 'auto', block: 'center' });
  }, [step]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  // Target not found (e.g. a step for a field that isn't rendered in this
  // state) — skip it rather than showing a broken spotlight.
  useEffect(() => {
    if (step && !document.querySelector(step.selector)) {
      if (stepIndex < tour.steps.length - 1) setStepIndex((i) => i + 1);
      else onClose();
    }
  }, [step, stepIndex, tour.steps.length, onClose]);

  if (!step) return null;

  const isLast = stepIndex === tour.steps.length - 1;

  // Place the callout below the target by default, above it if there isn't
  // room below (near the bottom of the viewport).
  const calloutTop = rect ? (rect.top + rect.height + 260 > window.innerHeight ? Math.max(16, rect.top - 220) : rect.top + rect.height + 12) : 0;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* Dimmed backdrop with a transparent cutout for the target element */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && <rect x={rect.left} y={rect.top} width={rect.width} height={rect.height} rx="12" fill="black" />}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(5,46,54,0.65)" mask="url(#tour-mask)" />
        {rect && (
          <rect x={rect.left} y={rect.top} width={rect.width} height={rect.height} rx="12" fill="none" stroke="#0B5563" strokeWidth="3" />
        )}
      </svg>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close tour"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-text shadow-lg"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="absolute left-1/2 w-[90vw] max-w-sm -translate-x-1/2 rounded-2xl bg-surface p-5 shadow-2xl sm:left-auto sm:translate-x-0"
        style={{
          top: calloutTop,
          ...(rect && rect.left + rect.width / 2 > window.innerWidth / 2
            ? { right: Math.max(16, window.innerWidth - rect.left - rect.width) }
            : { left: rect ? Math.max(16, rect.left) : '50%' }),
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase text-text-secondary">
            {stepIndex + 1} / {tour.steps.length}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`rounded-lg px-2 py-0.5 text-xs font-bold ${lang === 'en' ? 'bg-primary-600 text-white' : 'text-text-secondary'}`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang('ml')}
              className={`rounded-lg px-2 py-0.5 text-xs font-bold ${lang === 'ml' ? 'bg-primary-600 text-white' : 'text-text-secondary'}`}
            >
              മലയാളം
            </button>
          </div>
        </div>

        <p className="mt-2 font-bold text-text">{step.title[lang]}</p>
        <p className="mt-1 text-sm text-text-secondary">{step.body[lang]}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={onClose} className="text-xs font-semibold text-text-secondary hover:underline">
            {lang === 'en' ? 'Skip tour' : 'ടൂർ ഒഴിവാക്കുക'}
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex((i) => i - 1)}
                className="rounded-xl border border-border px-3 py-1.5 text-sm font-semibold text-text"
              >
                {lang === 'en' ? 'Back' : 'തിരികെ'}
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? onClose() : setStepIndex((i) => i + 1))}
              className="rounded-xl bg-primary-600 px-4 py-1.5 text-sm font-bold text-white"
            >
              {isLast ? (lang === 'en' ? 'Done' : 'പൂർത്തിയായി') : lang === 'en' ? 'Next' : 'അടുത്തത്'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
