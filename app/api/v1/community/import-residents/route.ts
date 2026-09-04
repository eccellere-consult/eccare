import { NextRequest, NextResponse } from 'next/server';
import { requireMembership } from '@/lib/community-route';
import { hashPassword } from '@/lib/auth';
import { parseResidentWorkbook, annotateRows, createResidents } from '@/lib/resident-import';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB — a resident register is a small file

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Bulk-registers residents from an uploaded .xlsx register — committee/admin
 *  only (same gate as community documents/notices). Two modes via the `commit`
 *  form field:
 *  - Preview (commit absent/false): parses + validates + duplicate-checks every
 *    row, creates nothing. Returns the full row-by-row report for the admin to
 *    review and select which rows to include.
 *  - Commit (commit=true): re-parses the same file (stateless — no server-side
 *    cache between the two calls) and creates a User + NeighborhoodMember for
 *    every row that's both status 'ready' and present in `includeRows`.
 *
 *  Role by age (60+  → elder, under 60 → caregiver/family member) and bad-phone
 *  rows are always skipped automatically — neither is overridable by inclusion,
 *  matching what was decided when this was scoped. */
export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail('VALIDATION', 'Could not read the uploaded file.');
  }

  const neighborhoodId = (formData.get('neighborhoodId') as string) || undefined;
  const guard = await requireMembership(req, { neighborhoodId, manage: true });
  if (guard.error) return guard.error;

  const file = formData.get('file') as File | null;
  if (!file) return fail('VALIDATION', 'No file uploaded.');
  if (file.size > MAX_SIZE) return fail('VALIDATION', 'File must be under 5 MB.');

  let rows;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseResidentWorkbook(buffer);
    rows = await annotateRows(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not read the file.';
    return fail('VALIDATION', `Could not read the spreadsheet: ${message}`);
  }

  const commit = (formData.get('commit') as string) === 'true';
  if (!commit) {
    return NextResponse.json({ success: true, data: { rows, committed: false } });
  }

  const password = (formData.get('password') as string) || '';
  if (password.length < 8) {
    return fail('VALIDATION', 'Please set a default password of at least 8 characters.');
  }

  let includeRowNumbers: Set<number>;
  try {
    const raw = JSON.parse((formData.get('includeRows') as string) || '[]');
    includeRowNumbers = new Set(Array.isArray(raw) ? raw.map(Number) : []);
  } catch {
    return fail('VALIDATION', 'Invalid row selection.');
  }

  const passwordHash = await hashPassword(password);
  const result = await createResidents(rows, guard.neighborhoodId, passwordHash, includeRowNumbers);

  return NextResponse.json({ success: true, data: { rows, committed: true, ...result } });
}
