import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const { id } = await params;
  const contact = await prisma.emergencyContact.findUnique({ where: { id } });
  if (!contact) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Contact not found.' } },
      { status: 404 },
    );
  }

  if (!(await canAccessElder(auth.userId, contact.userId))) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: "You don't have access to this contact." } },
      { status: 403 },
    );
  }

  await prisma.emergencyContact.delete({ where: { id } });

  return NextResponse.json({ success: true, data: null });
}
