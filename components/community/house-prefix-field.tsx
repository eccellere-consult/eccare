'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizeHousePrefix } from '@/lib/house';

/** The short code every house in a community starts with — "GRA" makes GRA-27, GRA-105 — set once when
 *  the community is registered, so residents only ever type their number. Shows the result as it is
 *  typed. With `onNoneChange`, also offers "our houses have names, not numbers". */
export function HousePrefixField({
  value,
  onChange,
  none,
  onNoneChange,
  id = 'housePrefix',
}: {
  value: string;
  onChange: (value: string) => void;
  none?: boolean;
  onNoneChange?: (none: boolean) => void;
  id?: string;
}) {
  const check = normalizeHousePrefix(value);
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>House prefix{onNoneChange ? ' *' : ''}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          if (e.target.value && none) onNoneChange?.(false);
        }}
        disabled={Boolean(none)}
        placeholder="GRA"
        maxLength={12}
        autoCapitalize="characters"
        autoComplete="off"
        className="max-w-40 font-bold uppercase tracking-wide"
      />
      <p className="text-xs text-text-secondary">
        {check.ok && check.value
          ? `Every house will be written ${check.value}-27, ${check.value}-105 … residents only type the number.`
          : !check.ok
            ? check.message
            : 'The short code every house here starts with, like GRA. Residents then only type their number.'}
      </p>
      {onNoneChange && (
        <label className="flex items-center gap-2 text-sm font-semibold text-text">
          <input
            type="checkbox"
            checked={Boolean(none)}
            onChange={(e) => {
              onNoneChange(e.target.checked);
              if (e.target.checked) onChange('');
            }}
            className="h-4 w-4"
          />
          Our houses have names, not numbers — no prefix
        </label>
      )}
    </div>
  );
}
