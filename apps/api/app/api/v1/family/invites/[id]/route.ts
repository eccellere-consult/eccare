import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser, toSafeUser } from '@/lib/auth';
import { z } from 'zod';

const schema = z.object({
  action: z.enum(['accept', 'decline']),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid request.' } },
      { status: 400 },
    );
  }

  const { id } = await params;
  const relation = await prisma.familyRelation.findUnique({ where: { id } });
  if (!relation || relation.elderUserId !== auth.userId) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Invite not found.' } },
      { status: 404 },
    );
  }

  const updated = await prisma.familyRelation.update({
    where: { id },
    data: { inviteStatus: parsed.data.action === 'accept' ? 'accepted' : 'declined' },
    include: { caregiverUser: true },
  });

  return NextResponse.json(
    { success: true, data: { ...updated, caregiverUser: toSafeUser(updated.caregiverUser) } },
  );
}
