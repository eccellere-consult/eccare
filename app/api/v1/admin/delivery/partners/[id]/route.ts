import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({
  // Razorpay Route linked account ID, e.g. acc_HjVXbtpSCIxENR. Empty clears it.
  razorpayLinkedAccountId: z
    .string()
    .trim()
    .regex(/^$|^acc_[A-Za-z0-9]{6,}$/, 'A linked account ID starts with acc_')
    .nullable(),
});

/** Admin saves a delivery partner's Razorpay Route linked account (id = ServiceProvider id). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'admin') return fail('FORBIDDEN', 'Admins only.', 403);
  const { id } = await params;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', parsed.error.issues[0]?.message || 'Please check the ID.');

  const profile = await prisma.deliveryPartnerProfile.findUnique({ where: { providerId: id }, select: { id: true } });
  if (!profile) return fail('NO_PROFILE', 'This partner has not saved their delivery details yet.', 409);

  const updated = await prisma.deliveryPartnerProfile.update({
    where: { id: profile.id },
    data: { razorpayLinkedAccountId: parsed.data.razorpayLinkedAccountId || null },
    select: { razorpayLinkedAccountId: true },
  });
  return NextResponse.json({ success: true, data: updated });
}
