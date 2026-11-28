import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { recheckDate } from '@/lib/care-staff';
import { fail, LISTING_INCLUDE, serialiseListing } from '@/lib/care-staff-server';

const schema = z.object({
  action: z.enum(['approve', 'changes', 'reject', 'pause']),
  note: z.string().trim().max(1000).optional(),
  // approve: the rate EC approves for each proposed rate (rate id -> amount).
  approvedRates: z.record(z.string(), z.number().positive().max(1_000_000)).optional(),
  // approve: check the person again after this many months (capped by document expiry).
  months: z.number().int().min(1).max(36).default(12),
});

/**
 * EC's decision on a person: approve (with the rates families will see and a re-check date),
 * ask for changes, reject, or take an approved person off the list. The provider sees the note.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'admin') return fail('FORBIDDEN', 'Admins only.', 403);
  const { id } = await params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('INVALID_INPUT', parsed.error.issues[0]?.message || 'Please check the details.');
  const { action, note, approvedRates = {}, months } = parsed.data;

  const listing = await prisma.careStaffListing.findUnique({
    where: { id },
    include: { rates: true, documents: { select: { kind: true, expiresOn: true } }, provider: { select: { verificationStatus: true } } },
  });
  if (!listing) return fail('NOT_FOUND', 'Listing not found.', 404);

  const now = new Date();
  const reviewed = { reviewedAt: now, reviewedById: auth.userId, adminNote: note || null };

  if (action === 'approve') {
    if (listing.provider.verificationStatus !== 'verified') {
      return fail('PROVIDER_NOT_VERIFIED', 'Approve the provider account first (Admin > Providers), then this person.');
    }
    const rates = listing.rates.filter((r) => approvedRates[r.id] !== undefined);
    if (!rates.length) return fail('NO_RATE', 'Approve at least one rate: families need to see a price.');
    const verifiedUntil = recheckDate(now, months, listing.documents.map((d) => d.expiresOn));
    if (verifiedUntil <= now) return fail('EXPIRED', 'A document has already expired. Ask the provider for a current one.');

    await prisma.$transaction([
      ...listing.rates.map((r) =>
        prisma.careStaffRate.update({ where: { id: r.id }, data: { approvedAmount: approvedRates[r.id] ?? null } }),
      ),
      prisma.careStaffListing.update({ where: { id }, data: { ...reviewed, status: 'approved', verifiedUntil } }),
    ]);
  } else {
    if (action !== 'pause' && !note) return fail('NOTE_NEEDED', 'Please write what the provider should know.');
    await prisma.careStaffListing.update({
      where: { id },
      data: { ...reviewed, status: action === 'changes' ? 'changes_needed' : action === 'reject' ? 'rejected' : 'paused' },
    });
  }

  const updated = await prisma.careStaffListing.findUniqueOrThrow({
    where: { id },
    include: {
      ...LISTING_INCLUDE,
      provider: {
        select: { id: true, businessName: true, phone: true, verificationStatus: true, serviceArea: true, user: { select: { name: true, email: true, phone: true } } },
      },
    },
  });
  return NextResponse.json({ success: true, data: serialiseListing(updated) });
}
