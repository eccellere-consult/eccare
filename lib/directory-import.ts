import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db';
import { isValidPhone, normalizePhone } from '@/lib/validation';

export type DirectoryImportRowStatus = 'ready' | 'duplicate-in-file' | 'already-registered' | 'already-imported';

export interface DirectoryImportRow {
  rowNumber: number; // 1-based spreadsheet row, shown to the admin for cross-reference
  name: string;
  houseNumber: string | null;
  rawPhone: string;
  phone: string | null; // normalized; null if nothing usable was found or the column was blank
  status: DirectoryImportRowStatus;
  existingLabel?: string | null; // human-readable "who this collides with", for duplicate statuses
}

const HEADER_MATCHERS: Record<string, (label: string) => boolean> = {
  name: (l) => l.includes('name'),
  house: (l) => l.includes('house') || l.includes('flat'),
  phone: (l) => l.includes('mobile') || l.includes('phone'),
};

/** Parses the first sheet of an uploaded directory register (.xlsx) — same
 *  flexible-header-matching approach as lib/resident-import.ts, but only
 *  Name/House/Phone matter here: no account gets created, so age (for
 *  elder/caregiver role) and email are irrelevant. A row with no usable
 *  phone is still kept (unlike resident-import, where phone is mandatory —
 *  it's how someone signs in): a name-only directory entry is still useful,
 *  it just won't get a WhatsApp-invite button later. */
export async function parseDirectoryWorkbook(
  buffer: Buffer,
): Promise<Array<Omit<DirectoryImportRow, 'status' | 'existingLabel'>>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const colIndex: Partial<Record<keyof typeof HEADER_MATCHERS, number>> = {};
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const label = String(cell.value ?? '').trim().toLowerCase();
    for (const [key, matches] of Object.entries(HEADER_MATCHERS)) {
      if (matches(label) && !(key in colIndex)) colIndex[key as keyof typeof HEADER_MATCHERS] = colNumber;
    }
  });

  const cellText = (row: ExcelJS.Row, idx?: number): string => {
    if (!idx) return '';
    const value = row.getCell(idx).value;
    if (value == null) return '';
    if (typeof value === 'object' && 'text' in value) return String((value as { text: unknown }).text ?? '').trim();
    return String(value).trim();
  };

  const rows: Array<Omit<DirectoryImportRow, 'status' | 'existingLabel'>> = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const name = cellText(row, colIndex.name);
    if (!name) continue; // blank row

    const houseNumber = cellText(row, colIndex.house) || null;
    const rawPhone = cellText(row, colIndex.phone);
    const firstPhone = rawPhone.split(',')[0]?.trim() ?? '';
    const phone = isValidPhone(firstPhone) ? normalizePhone(firstPhone) : null;

    rows.push({ rowNumber: r, name, houseNumber, rawPhone, phone });
  }
  return rows;
}

/** Adds duplicate/validity status. Only rows with a phone are checked against
 *  anything — a name-only row always comes back 'ready' since there's no
 *  reliable key to dedupe it by. Checks, in order: within-file duplicates,
 *  then an already-registered NeighborhoodMember in this same community
 *  (importing them as "unregistered" would be redundant — they already have
 *  a real account), then an already-imported UnregisteredResident (don't
 *  create the same directory entry twice on a re-upload). */
export async function annotateDirectoryRows(
  rows: Array<Omit<DirectoryImportRow, 'status' | 'existingLabel'>>,
  neighborhoodId: string,
): Promise<DirectoryImportRow[]> {
  const seenPhones = new Set<string>();
  const out: DirectoryImportRow[] = [];

  for (const row of rows) {
    if (!row.phone) {
      out.push({ ...row, status: 'ready', existingLabel: null });
      continue;
    }
    if (seenPhones.has(row.phone)) {
      out.push({ ...row, status: 'duplicate-in-file', existingLabel: null });
      continue;
    }
    seenPhones.add(row.phone);

    const existingMember = await prisma.neighborhoodMember.findFirst({
      where: { neighborhoodId, user: { phone: row.phone } },
      select: { user: { select: { name: true } } },
    });
    if (existingMember) {
      out.push({ ...row, status: 'already-registered', existingLabel: existingMember.user.name });
      continue;
    }

    const existingImport = await prisma.unregisteredResident.findFirst({
      where: { neighborhoodId, phone: row.phone },
      select: { name: true },
    });
    if (existingImport) {
      out.push({ ...row, status: 'already-imported', existingLabel: existingImport.name });
      continue;
    }

    out.push({ ...row, status: 'ready', existingLabel: null });
  }

  return out;
}

/** Creates one UnregisteredResident per included, 'ready' row — no User, no
 *  password, nothing to sign in with. Returns both the count and the created
 *  rows themselves (id/name/phone) so the caller can immediately offer a
 *  WhatsApp-invite step without a second fetch. */
export async function createUnregisteredResidents(
  rows: DirectoryImportRow[],
  neighborhoodId: string,
  importedById: string,
  includedRowNumbers: Set<number>,
): Promise<{ created: Array<{ id: string; name: string; phone: string | null }>; skipped: number }> {
  const created: Array<{ id: string; name: string; phone: string | null }> = [];
  let skipped = 0;

  for (const row of rows) {
    if (row.status !== 'ready' || !includedRowNumbers.has(row.rowNumber)) {
      skipped++;
      continue;
    }
    const entry = await prisma.unregisteredResident.create({
      data: {
        neighborhoodId,
        name: row.name,
        phone: row.phone ?? undefined,
        flatNumber: row.houseNumber ?? undefined,
        importedById,
      },
      select: { id: true, name: true, phone: true },
    });
    created.push(entry);
  }

  return { created, skipped };
}
