import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const schema = z.object({
  name: z.string().min(1).max(160),
  city: z.string().max(80).optional(),
  pincode: z.string().max(12).optional(),
  description: z.string().max(2000).optional(),
});

/** Human-friendly, unambiguous join code — no 0/O or 1/I, since residents read these
 *  aloud and type them by hand. */
function generateJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

const forbidden = () =>
  NextResponse.json(
    { success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } },
    { status: 403 },
  );

/** Platform admin: list all communities. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }
  if (auth.role !== 'admin') return forbidden();

  const neighborhoods = await prisma.neighborhood.findMany({
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: neighborhoods });
}

/**
 * Platform admin: create a community. The creator is enrolled as its first `admin`
 * member in the same transaction — a community with no one able to manage it would
 * be immediately stuck (no announcements, no helplines, no way to answer queries).
 */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }
  if (auth.role !== 'admin') return forbidden();

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Please enter a community name.' } },
      { status: 400 },
    );
  }

  // Retry on the (unlikely) chance of a join-code collision.
  let neighborhood = null;
  for (let attempt = 0; attempt < 5 && !neighborhood; attempt++) {
    const joinCode = generateJoinCode();
    const existing = await prisma.neighborhood.findUnique({ where: { joinCode } });
    if (existing) continue;

    neighborhood = await prisma.neighborhood.create({
      data: {
        ...parsed.data,
        joinCode,
        members: { create: { userId: auth.userId, role: 'admin' } },
      },
    });
  }

  if (!neighborhood) {
    return NextResponse.json(
      { success: false, error: { code: 'RETRY', message: 'Could not create community. Please try again.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: neighborhood }, { status: 201 });
}
