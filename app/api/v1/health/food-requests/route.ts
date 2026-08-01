import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';
import { sendPushToTokens } from '@/lib/fcm';

const createSchema = z.object({
  elderUserId: z.string().optional(),
  requestType: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'other']),
  notes: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  const guard = await requireHealthAccess(req);
  if (guard instanceof Response) return guard;

  const requests = await prisma.foodRequest.findMany({
    where: { userId: guard.elderUserId },
    include: {
      handler: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  return ok(requests);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const guard = await requireHealthAccess(req, body.elderUserId);
  if (guard instanceof Response) return guard;

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0].message);

  const foodReq = await prisma.foodRequest.create({
    data: {
      userId: guard.elderUserId,
      requestType: parsed.data.requestType,
      notes: parsed.data.notes,
    },
  });

  const caregiverTokens = await prisma.familyRelation.findMany({
    where: { elderUserId: guard.elderUserId, inviteStatus: 'accepted' },
    include: { caregiverUser: { include: { deviceTokens: true } } },
  }).then((rels) =>
    rels.flatMap((r) => r.caregiverUser.deviceTokens.map((dt) => dt.token)),
  );

  const elder = await prisma.user.findUnique({
    where: { id: guard.elderUserId },
    select: { name: true },
  });

  if (caregiverTokens.length > 0) {
    await sendPushToTokens(caregiverTokens, {
      title: 'Meal request',
      body: `${elder?.name ?? 'Your elder'} needs help with ${parsed.data.requestType}.`,
      data: { type: 'food_request', requestId: foodReq.id },
    });
  }

  return ok(foodReq, 201);
}
