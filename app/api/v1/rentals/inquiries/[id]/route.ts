import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({ status: z.enum(['open', 'scheduled', 'closed']) });

/** Lister-only status update — 'scheduled' once a visit is arranged (by phone,
 *  same as everywhere else in this app), 'closed' once resolved either way. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const inquiry = await prisma.rentalInquiry.findUnique({ where: { id }, include: { listing: true } });
  if (!inquiry) return fail('NOT_FOUND', 'Inquiry not found.', 404);
  if (inquiry.listing.postedById !== auth.userId) return fail('FORBIDDEN', 'Only the lister can update this inquiry.', 403);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please select a valid status.');

  const updated = await prisma.rentalInquiry.update({ where: { id }, data: { status: parsed.data.status } });
  return NextResponse.json({ success: true, data: updated });
}
