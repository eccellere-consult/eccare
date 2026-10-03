'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { composeHouse, parseHouse, type HouseParts } from '@/lib/house';

export interface HouseFieldLabels {
  block: string;
  blockPlaceholder: string;
  number: string;
  numberPlaceholder: string;
  houseName: string;
  houseNamePlaceholder: string;
  useName: string;
  useBlock: string;
  helper: string;
}

export const ENGLISH_HOUSE_LABELS: HouseFieldLabels = {
  block: 'Block / association',
  blockPlaceholder: 'GRA or A',
  number: 'House / flat number',
  numberPlaceholder: '105',
  houseName: 'House name',
  houseNamePlaceholder: 'Rose Villa',
  useName: 'No block or number? Use a house name instead',
  useBlock: 'Use block and number instead',
  helper: 'Block or association + number, like GRA-105 or A-105. No block? Use the house name.',
};

/** The one way a house number is entered anywhere: block/association + number, or a
 *  house name when a community has neither. Reports a single canonical string via
 *  onChange ('' while incomplete); the caller still validates it with
 *  normalizeHouseInput (lib/house.ts) on submit — the server does too. */
export function HouseField({
  id,
  value,
  onChange,
  labels = ENGLISH_HOUSE_LABELS,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  labels?: HouseFieldLabels;
}) {
  const [parts, setParts] = useState<HouseParts>(() => parseHouse(value));

  function update(next: Partial<HouseParts>) {
    const merged = { ...parts, ...next };
    setParts(merged);
    onChange(composeHouse(merged));
  }

  return (
    <div className="flex flex-col gap-2">
      {parts.mode === 'block' ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-block`}>{labels.block}</Label>
            <Input
              id={`${id}-block`}
              value={parts.block}
              onChange={(e) => update({ block: e.target.value.toUpperCase() })}
              placeholder={labels.blockPlaceholder}
              autoCapitalize="characters"
              maxLength={10}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-number`}>{labels.number}</Label>
            <Input
              id={`${id}-number`}
              value={parts.number}
              onChange={(e) => update({ number: e.target.value })}
              placeholder={labels.numberPlaceholder}
              maxLength={8}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-name`}>{labels.houseName}</Label>
          <Input
            id={`${id}-name`}
            value={parts.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder={labels.houseNamePlaceholder}
            maxLength={32}
          />
        </div>
      )}
      <button
        type="button"
        onClick={() => update({ mode: parts.mode === 'block' ? 'name' : 'block' })}
        className="w-fit text-xs font-semibold text-primary-600 hover:underline"
      >
        {parts.mode === 'block' ? labels.useName : labels.useBlock}
      </button>
      <p className="text-xs text-text-secondary">{labels.helper}</p>
    </div>
  );
}
