import { NextRequest, NextResponse } from 'next/server';
import { requireMembership } from '@/lib/community-route';
import { parseDirectoryWorkbook, annotateDirectoryRows, createUnregisteredResidents } from '@/lib/directory-import';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB — a directory register is a small file

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Bulk-adds people to the Local Directory from an uploaded .xlsx register
 *  WITHOUT registering them — no User account, no password, nothing to sign
 *  in with (see UnregisteredResident in schema.prisma). Committee/admin only,
 *  same gate as the resident-registration import. Same two-phase `commit`
 *  form-field pattern as POST /api/v1/community/import-residents:
 *  - Preview (commit absent/false): parses + duplicate-checks every row,
 *    creates nothing.
 *  - Commit (commit=true): re-parses the same file and creates an
 *    UnregisteredResident for every row that's both 'ready' and present in
 *    `includeRows`. Returns the created rows themselves (not just a count)
 *    so the admin page can immediately offer a WhatsApp-invite step. */
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
    const parsed = await parseDirectoryWorkbook(buffer);
    rows = await annotateDirectoryRows(parsed, guard.neighborhoodId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not read the file.';
    return fail('VALIDATION', `Could not read the spreadsheet: ${message}`);
  }

  const commit = (formData.get('commit') as string) === 'true';
  if (!commit) {
    return NextResponse.json({ success: true, data: { rows, committed: false } });
  }

  let includeRowNumbers: Set<number>;
  try {
    const raw = JSON.parse((formData.get('includeRows') as string) || '[]');
    includeRowNumbers = new Set(Array.isArray(raw) ? raw.map(Number) : []);
  } catch {
    return fail('VALIDATION', 'Invalid row selection.');
  }

  const result = await createUnregisteredResidents(rows, guard.neighborhoodId, guard.auth.userId, includeRowNumbers);

  return NextResponse.json({
    success: true,
    data: { rows, committed: true, created: result.created, skipped: result.skipped },
  });
}
