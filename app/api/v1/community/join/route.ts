import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { invalidInput, ok } from '@/lib/community-route';

const schema = z.object({
  joinCode: z.string().min(4).max(32),
  flatNumber: z.string().max(32).optional(),
});

/** Join a neighbourhood using its share code. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please enter a valid community code.');

  const { joinCode, flatNumber } = parsed.data;

  const neighborhood = await prisma.neighborhood.findUnique({
    where: { joinCode: joinCode.trim().toUpperCase() },
  });
  if (!neighborhood) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'No community found with that code.' } },
      { status: 404 },
    );
  }

  const existing = await prisma.neighborhoodMember.findUnique({
    where: { neighborhoodId_userId: { neighborhoodId: neighborhood.id, userId: auth.userId } },
  });
  if (existing) return ok({ neighborhood, alreadyMember: true });

  await prisma.neighborhoodMember.create({
    data: { neighborhoodId: neighborhood.id, userId: auth.userId, flatNumber },
  });

  return ok({ neighborhood, alreadyMember: false }, 201);
}
