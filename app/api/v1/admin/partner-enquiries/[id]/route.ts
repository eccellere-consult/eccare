import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { PARTNER_STATUSES } from '@/lib/partner-enquiry';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({ status: z.enum(PARTNER_STATUSES) });

/** Platform admin: mark an enquiry new, contacted or closed. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'admin') return fail('FORBIDDEN', 'Admins only.', 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('INVALID_INPUT', 'Choose new, contacted or closed.', 400);

  const { id } = await params;
  const existing = await prisma.partnerEnquiry.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return fail('NOT_FOUND', 'Enquiry not found.', 404);

  const updated = await prisma.partnerEnquiry.update({ where: { id }, data: { status: parsed.data.status } });
  return NextResponse.json({ success: true, data: updated });
}
