import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

/** Fee definitions the committee/admin has set up for their community — e.g.
 *  "Monthly Maintenance" at ₹1500/flat. Read is committee/admin only (residents
 *  see their own bills via /api/v1/community/fee-charges instead, not the fee
 *  catalogue itself). */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req, { manage: true });
  if (guard.error) return guard.error;

  const fees = await prisma.communityFee.findMany({
    where: { neighborhoodId: guard.neighborhoodId },
    orderBy: { createdAt: 'desc' },
  });

  return ok(fees);
}

const createSchema = z.object({
  label: z.string().trim().min(1).max(100),
  defaultAmount: z.number().positive(),
  frequency: z.enum(['monthly', 'one_time']).default('monthly'),
});

export async function POST(req: NextRequest) {
  const guard = await requireMembership(req, { manage: true });
  if (guard.error) return guard.error;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please enter a label and a positive amount.');

  const fee = await prisma.communityFee.create({
    data: {
      neighborhoodId: guard.neighborhoodId,
      label: parsed.data.label,
      defaultAmount: parsed.data.defaultAmount,
      frequency: parsed.data.frequency,
      createdById: guard.auth.userId,
    },
  });

  return ok(fee, 201);
}
