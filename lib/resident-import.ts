import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db';
import { isValidPhone, isValidEmail, normalizePhone } from '@/lib/validation';

export type ImportRowStatus = 'ready' | 'bad-phone' | 'bad-age' | 'duplicate-in-file' | 'duplicate-existing';

export interface ImportRow {
  rowNumber: number; // 1-based spreadsheet row, shown to the admin for cross-reference
  name: string;
  age: number | null;
  houseNumber: string | null;
  grNo: string | null; // shown for review only — no field for this in the data model
  email: string | null;
  rawPhone: string;
  phone: string | null; // normalized; null if nothing usable was found
  role: 'elder' | 'caregiver' | null; // by age: 60+ = elder, under 60 = family member (caregiver)
  status: ImportRowStatus;
  existingUser?: { id: string; name: string } | null;
}

const HEADER_MATCHERS: Record<string, (label: string) => boolean> = {
  name: (l) => l.includes('name'),
  age: (l) => l === 'age',
  house: (l) => l.includes('house') || l.includes('flat'),
  gr: (l) => l.includes('gr'),
  email: (l) => l.includes('email'),
  phone: (l) => l.includes('mobile') || l.includes('phone'),
};

/** Parses the first sheet of an uploaded resident register (.xlsx). Column order
 *  doesn't matter — headers are matched flexibly by keyword, so "Mobile No.",
 *  "Mobile Number", "Phone" all resolve to the same field. Pure parsing, no DB
 *  access and no duplicate detection — see annotateRows for that. */
export async function parseResidentWorkbook(
  buffer: Buffer,
): Promise<Array<Omit<ImportRow, 'status' | 'existingUser'>>> {
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

  const rows: Array<Omit<ImportRow, 'status' | 'existingUser'>> = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const name = cellText(row, colIndex.name);
    if (!name) continue; // blank row

    const ageText = cellText(row, colIndex.age);
    const age = /^\d{1,3}$/.test(ageText) ? Number(ageText) : null;
    const houseNumber = cellText(row, colIndex.house) || null;
    const grNo = cellText(row, colIndex.gr) || null;

    const emailText = cellText(row, colIndex.email);
    const email = isValidEmail(emailText) ? emailText : null;

    const rawPhone = cellText(row, colIndex.phone);
    // A cell with two numbers ("9567663093, 9446388753") — take the first as
    // primary; the rest aren't captured anywhere (single-phone-per-account model).
    const firstPhone = rawPhone.split(',')[0]?.trim() ?? '';
    const phone = isValidPhone(firstPhone) ? normalizePhone(firstPhone) : null;

    const role: ImportRow['role'] = age === null ? null : age >= 60 ? 'elder' : 'caregiver';

    rows.push({ rowNumber: r, name, age, houseNumber, grNo, email, rawPhone, phone, role });
  }
  return rows;
}

/** Adds duplicate/validity status to parsed rows — within-file duplicates (same
 *  normalized phone twice in one upload) and against-DB duplicates (phone already
 *  registered). Order matters: a row is only checked against the DB once it's
 *  confirmed not to collide with an earlier row in the same file. */
export async function annotateRows(
  rows: Array<Omit<ImportRow, 'status' | 'existingUser'>>,
): Promise<ImportRow[]> {
  const seenPhones = new Set<string>();
  const out: ImportRow[] = [];

  for (const row of rows) {
    if (!row.phone) {
      out.push({ ...row, status: 'bad-phone', existingUser: null });
      continue;
    }
    if (!row.role) {
      out.push({ ...row, status: 'bad-age', existingUser: null });
      continue;
    }
    if (seenPhones.has(row.phone)) {
      out.push({ ...row, status: 'duplicate-in-file', existingUser: null });
      continue;
    }
    seenPhones.add(row.phone);

    const existing = await prisma.user.findUnique({ where: { phone: row.phone }, select: { id: true, name: true } });
    if (existing) {
      out.push({ ...row, status: 'duplicate-existing', existingUser: existing });
      continue;
    }

    out.push({ ...row, status: 'ready', existingUser: null });
  }

  return out;
}

/** Creates one User + NeighborhoodMember per included row. Only rows with
 *  status 'ready' AND an explicit include from the admin's review are ever
 *  creatable — 'bad-phone'/'bad-age' rows have no valid phone/role to create
 *  with regardless of inclusion, and a 'duplicate' row can't be created (phone
 *  is a unique column) even if included, so this silently no-ops those instead
 *  of throwing mid-batch. Returns which rows were actually created vs skipped. */
export async function createResidents(
  rows: ImportRow[],
  neighborhoodId: string,
  passwordHash: string,
  includedRowNumbers: Set<number>,
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  // House/flat number previously only ever reached NeighborhoodMember.flatNumber
  // (which is what the community Members list and neighbour directory already
  // read) — the User's own address/city/pincode stayed blank, so a resident's
  // own profile never showed where they actually live. Fetched once for the
  // whole batch since every row shares the same community's city/pincode.
  const neighborhood = await prisma.neighborhood.findUnique({
    where: { id: neighborhoodId },
    select: { city: true, pincode: true },
  });

  for (const row of rows) {
    if (row.status !== 'ready' || !row.phone || !row.role || !includedRowNumbers.has(row.rowNumber)) {
      skipped++;
      continue;
    }

    try {
      const user = await prisma.user.create({
        data: {
          name: row.name,
          phone: row.phone,
          email: row.email ?? undefined,
          role: row.role,
          passwordHash,
          address: row.houseNumber ?? undefined,
          city: neighborhood?.city ?? undefined,
          pincode: neighborhood?.pincode ?? undefined,
        },
      });
      await prisma.neighborhoodMember.create({
        data: { neighborhoodId, userId: user.id, flatNumber: row.houseNumber ?? undefined },
      });
      created++;
    } catch {
      // Phone claimed by a concurrent request between preview and commit — rare,
      // but don't let one row's race condition fail the whole batch.
      skipped++;
    }
  }

  return { created, skipped };
}
