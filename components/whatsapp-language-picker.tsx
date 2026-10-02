'use client';

import { Label } from '@/components/ui/label';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/languages';
import { cn } from '@/lib/utils';

/** Pick one or more languages for a WhatsApp message. English is the default;
 *  more than one stacks them into a single message, in the order chosen, for
 *  someone who reads more than one. At least one always stays selected. */
export function WhatsAppLanguagePicker({
  languages,
  setLanguages,
}: {
  languages: string[];
  setLanguages: (languages: string[]) => void;
}) {
  function toggle(code: string) {
    if (languages.includes(code)) {
      if (languages.length > 1) setLanguages(languages.filter((c) => c !== code));
    } else {
      setLanguages([...languages, code]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Message language{languages.length > 1 ? 's (sent together, in this order)' : ''}</Label>
      <div className="flex flex-wrap gap-2">
        {SUPPORTED_LANGUAGES.map((l) => {
          const on = languages.includes(l.code);
          return (
            <button
              key={l.code}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(l.code)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
                on ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary hover:border-primary-300',
              )}
            >
              {l.native}
              {on && languages.length > 1 ? ` · ${languages.indexOf(l.code) + 1}` : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}
