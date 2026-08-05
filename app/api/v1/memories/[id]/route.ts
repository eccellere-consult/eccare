import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 });
  }

  const { id } = await params;
  const memory = await prisma.memory.findUnique({ where: { id } });
  if (!memory) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Memory not found.' } }, { status: 404 });
  }

  if (!(await canAccessElder(auth.userId, memory.elderUserId))) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: "You don't have access to this memory." } },
      { status: 403 },
    );
  }

  try {
    await unlink(path.join(process.cwd(), 'public', memory.imagePath));
  } catch {
    // file may already be gone
  }

  await prisma.memory.delete({ where: { id } });
  return NextResponse.json({ success: true, data: null });
}
