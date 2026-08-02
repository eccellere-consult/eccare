import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const patchSchema = z.object({
  verificationStatus: z.enum(['pending', 'verified', 'rejected']),
  rejectionReason: z.string().max(2000).optional(),
});

type AdminGuard =
  | { error: NextResponse; auth?: never }
  | { error?: never; auth: { userId: string; role: string } };

async function requireAdmin(req: NextRequest): Promise<AdminGuard> {
  const auth = await getAuthUser(req);
  if (!auth) return { error: NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 }) };
  if (auth.role !== 'admin') return { error: NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403 }) };
  return { auth };
}

/** Approve or reject a service-provider application. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (guard.error) return guard.error;
  const { auth } = guard;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid request.' } },
      { status: 400 },
    );
  }

  const { id } = await params;
  const { verificationStatus, rejectionReason } = parsed.data;

  const provider = await prisma.serviceProvider.update({
    where: { id },
    data: {
      verificationStatus,
      rejectionReason: verificationStatus === 'rejected' ? (rejectionReason ?? null) : null,
      verifiedAt: verificationStatus === 'verified' ? new Date() : null,
      verifiedById: verificationStatus === 'verified' ? auth.userId : null,
    },
    include: { user: { select: { id: true, name: true, email: true, phone: true } } },
  });

  return NextResponse.json({ success: true, data: provider });
}
