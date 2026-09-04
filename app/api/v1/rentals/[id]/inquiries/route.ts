import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({
  message: z.string().max(1000).optional(),
  visitDate: z.string().datetime().optional(),
});

/** Lister-only: every inquiry on their listing. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const listing = await prisma.rentalListing.findUnique({ where: { id } });
  if (!listing) return fail('NOT_FOUND', 'Listing not found.', 404);
  if (listing.postedById !== auth.userId) return fail('FORBIDDEN', 'Only the lister can view inquiries.', 403);

  const inquiries = await prisma.rentalInquiry.findMany({
    where: { listingId: id },
    include: { inquirer: { select: { id: true, name: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: inquiries });
}

/** One inquiry per (listing, inquirer) — a second submission updates the first
 *  rather than creating a duplicate thread. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const listing = await prisma.rentalListing.findUnique({ where: { id } });
  if (!listing) return fail('NOT_FOUND', 'Listing not found.', 404);
  if (listing.postedById === auth.userId) return fail('OWN_LISTING', "You can't inquire about your own listing.", 400);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please check the details and try again.');

  const inquiry = await prisma.rentalInquiry.upsert({
    where: { listingId_inquirerId: { listingId: id, inquirerId: auth.userId } },
    create: {
      listingId: id,
      inquirerId: auth.userId,
      message: parsed.data.message,
      visitDate: parsed.data.visitDate ? new Date(parsed.data.visitDate) : undefined,
    },
    update: {
      message: parsed.data.message,
      visitDate: parsed.data.visitDate ? new Date(parsed.data.visitDate) : undefined,
      status: 'open',
    },
  });

  return NextResponse.json({ success: true, data: inquiry }, { status: 201 });
}
