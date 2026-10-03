/** One consistent shape for a house / flat number across the whole product, so the
 *  directory can be sorted, searched and matched (lib/directory-link.ts) instead of
 *  holding "A101", "a-101", "Flat 101" and "101 A block" for the same place.
 *
 *  Either:
 *   - a BLOCK or ASSOCIATION prefix plus the actual number — "GRA-105", "A-105" — or
 *   - where a community has neither, a text HOUSE NAME — "Rose Villa".
 *
 *  Stored as the single string already in NeighborhoodMember.flatNumber /
 *  UnregisteredResident.flatNumber, so nothing in the schema changes and older
 *  values keep working; they're simply tidied the next time someone edits them.
 *  Pure and dependency-free: used by the forms (client) and the routes (server). */

export const HOUSE_REQUIRED_MESSAGE =
  'Please enter your house number — the block or association and the number (like GRA-105 or A-105), or a house name if there is no block.';
export const HOUSE_FORMAT_HINT = 'Block or association + number, like GRA-105 or A-105. No block? Use the house name.';

// "GRA 105", "gra-105", "A/105", "A105", "Villa 12" — a letter-led prefix, then a number.
// Lazy block so "A105" is block A + 105, not block "A10" + 5.
const BLOCK_NUMBER = /^([A-Za-z][A-Za-z0-9]{0,9}?)[\s\-/.]*(\d{1,6}[A-Za-z]?)$/;
const BARE_NUMBER = /^\d{1,6}[A-Za-z]?$/;
const MAX_LEN = 32;

export interface HouseParts {
  mode: 'block' | 'name';
  block: string;
  number: string;
  name: string;
}

export type HouseResult = { ok: true; value: string } | { ok: false; message: string };

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Canonical form for what the form sends / the server stores. `defaultBlock` is
 *  put in front of a bare number (a spreadsheet column that just says "45"). */
export function normalizeHouseInput(raw: string | null | undefined, opts: { defaultBlock?: string } = {}): HouseResult {
  const text = tidy(raw ?? '');
  if (!text) return { ok: false, message: HOUSE_REQUIRED_MESSAGE };
  if (text.length > MAX_LEN) return { ok: false, message: `Please keep the house number or name under ${MAX_LEN} characters.` };

  const bn = BLOCK_NUMBER.exec(text);
  if (bn) return { ok: true, value: `${bn[1].toUpperCase()}-${bn[2].toUpperCase()}` };

  if (BARE_NUMBER.test(text)) {
    const block = tidy(opts.defaultBlock ?? '').toUpperCase();
    if (block && /^[A-Z][A-Z0-9]{0,9}$/.test(block)) return { ok: true, value: `${block}-${text.toUpperCase()}` };
    return {
      ok: false,
      message: `"${text}" needs its block or association in front, like GRA-${text} or A-${text}.`,
    };
  }

  // A house name: must actually contain letters, not just punctuation/digit soup.
  if (/\p{L}{2,}/u.test(text)) return { ok: true, value: text };
  return { ok: false, message: HOUSE_REQUIRED_MESSAGE };
}

/** Splits a stored value back into the form's fields for editing. */
export function parseHouse(value: string | null | undefined): HouseParts {
  const text = tidy(value ?? '');
  const bn = BLOCK_NUMBER.exec(text);
  if (bn) return { mode: 'block', block: bn[1].toUpperCase(), number: bn[2].toUpperCase(), name: '' };
  if (text && !BARE_NUMBER.test(text)) return { mode: 'name', block: '', number: '', name: text };
  // Empty, or an old bare number with no block: start in block mode, number filled.
  return { mode: 'block', block: '', number: BARE_NUMBER.test(text) ? text : '', name: '' };
}

/** What the form reports upward as the user types: the joined string, or '' while incomplete. */
export function composeHouse(parts: HouseParts): string {
  if (parts.mode === 'name') return tidy(parts.name);
  const block = tidy(parts.block);
  const number = tidy(parts.number);
  return block && number ? `${block}-${number}` : '';
}

/** Compares houses across spellings: "A-101", "a 101", "Flat No. A/101" all become
 *  "a101"; "House 12" becomes "12". Used to match directory entries
 *  (lib/directory-link.ts) and to key a house's saved location. */
export function houseKey(value: string | null | undefined): string {
  if (!value) return '';
  const lower = value.toLowerCase();
  // The filler words ("Flat No.", "House") only come in front of a number. A text
  // house name like "Rose Villa" keeps all of its words, so it can't collide with
  // "Rose" or "Rose Cottage".
  const stripped = /\d/.test(lower)
    ? lower.replace(/\b(house|flat|apartment|apt|unit|villa|plot|door|gr|no|number)\b\.?/g, '')
    : lower;
  return stripped.replace(/[^a-z0-9]/g, '');
}
