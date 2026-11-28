import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { deleteFromStorage } from '@/lib/storage';
import { aadhaarLast4, missingForSubmit, RATE_UNITS, STAFF_ROLES } from '@/lib/care-staff';
import { careStaffProviderFor, fail, LISTING_INCLUDE, serialiseListing } from '@/lib/care-staff-server';

const ROLE_VALUES = STAFF_ROLES.map((r) => r.value) as [string, ...string[]];

const patchSchema = z.object({
  personName: z.string().trim().min(2).max(80).optional(),
  role: z.enum(ROLE_VALUES).optional(),
  qualification: z.string().trim().max(120).nullable().optional(),
  experienceYears: z.number().int().min(0).max(60).nullable().optional(),
  languages: z.string().trim().max(120).nullable().optional(),
  about: z.string().trim().max(1000).nullable().optional(),
  // Accepts the last 4 digits (or a full number typed by mistake: only the last 4 are kept).
  aadhaar: z.string().max(20).nullable().optional(),
  expectedSalary: z.number().min(0).max(1_000_000).nullable().optional(),
  // The whole list of rates; replaces the old one.
  rates: z
    .array(z.object({ unit: z.enum(RATE_UNITS), amount: z.number().positive().max(1_000_000), note: z.string().trim().max(80).nullable().optional() }))
    .max(6)
    .optional(),
  action: z.enum(['save', 'submit', 'pause', 'resume']).default('save'),
});

async function ownListing(userId: string, id: string) {
  const provider = await careStaffProviderFor(userId);
  if (!provider) return null;
  const listing = await prisma.careStaffListing.findFirst({ where: { id, providerId: provider.id }, include: LISTING_INCLUDE });
  return listing ? { provider, listing } : null;
}

/**
 * Saves a person's details and proposed rates, sends them to EC for checking, or pauses /
 * resumes an approved listing. Changing anything on an approved listing sends it back to EC
 * (it is hidden from families until checked again), so families only ever see checked details.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  const { id } = await params;
  const own = await ownListing(auth.userId, id);
  if (!own) return fail('NOT_FOUND', 'Listing not found.', 404);
  const { listing } = own;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('INVALID_INPUT', parsed.error.issues[0]?.message || 'Please check the details.');
  const { action, rates, aadhaar, ...fields } = parsed.data;

  if (action === 'pause' || action === 'resume') {
    const allowed = action === 'pause' ? listing.status === 'approved' : listing.status === 'paused';
    if (!allowed) return fail('BAD_STATE', action === 'pause' ? 'Only a listed person can be paused.' : 'This listing is not paused.');
    const updated = await prisma.careStaffListing.update({
      where: { id },
      data: { status: action === 'pause' ? 'paused' : 'approved' },
      include: LISTING_INCLUDE,
    });
    return NextResponse.json({ success: true, data: serialiseListing(updated) });
  }

  if (listing.status === 'rejected') return fail('BAD_STATE', 'EC did not approve this listing. Please add the person again if things have changed.');

  const last4 = aadhaar === undefined ? undefined : aadhaar === null || aadhaar.trim() === '' ? null : aadhaarLast4(aadhaar);
  if (aadhaar && last4 === null) return fail('INVALID_INPUT', 'Please type the last 4 digits of the Aadhaar number.');

  const changed = Object.keys(fields).length > 0 || rates !== undefined || last4 !== undefined;
  const wasListed = listing.status === 'approved' || listing.status === 'paused';

  await prisma.$transaction(async (tx) => {
    await tx.careStaffListing.update({
      where: { id },
      data: {
        ...fields,
        ...(fields.personName ? { personName: fields.personName.toUpperCase() } : {}),
        ...(last4 !== undefined ? { aadhaarLast4: last4 } : {}),
        // A change to a checked listing hides it until EC checks it again.
        ...(changed && wasListed ? { status: 'submitted', submittedAt: new Date() } : {}),
      },
    });
    if (rates) {
      await tx.careStaffRate.deleteMany({ where: { listingId: id } });
      if (rates.length) {
        await tx.careStaffRate.createMany({
          data: rates.map((r) => ({ listingId: id, unit: r.unit, proposedAmount: r.amount, note: r.note ?? null })),
        });
      }
    }
  });

  let updated = await prisma.careStaffListing.findUniqueOrThrow({ where: { id }, include: LISTING_INCLUDE });

  if (action === 'submit') {
    const missing = missingForSubmit({
      personName: updated.personName,
      role: updated.role,
      aadhaarLast4: updated.aadhaarLast4,
      documents: updated.documents,
      rates: updated.rates.map((r) => ({ proposedAmount: Number(r.proposedAmount) })),
    });
    if (missing.length) return fail('INCOMPLETE', `Still needed: ${missing.join('; ')}.`);
    updated = await prisma.careStaffListing.update({
      where: { id },
      data: { status: 'submitted', submittedAt: new Date() },
      include: LISTING_INCLUDE,
    });
  }

  return NextResponse.json({ success: true, data: serialiseListing(updated) });
}

/** Removes a person and their documents (files too). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  const { id } = await params;
  const own = await ownListing(auth.userId, id);
  if (!own) return fail('NOT_FOUND', 'Listing not found.', 404);

  const files = await prisma.careStaffDocument.findMany({ where: { listingId: id }, select: { filePath: true } });
  await prisma.careStaffListing.delete({ where: { id } });
  await Promise.all(files.map((f) => deleteFromStorage(f.filePath).catch(() => {})));
  return NextResponse.json({ success: true, data: { id } });
}
