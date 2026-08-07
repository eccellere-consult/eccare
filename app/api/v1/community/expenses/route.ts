import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const schema = z.object({
  label: z.string().min(1).max(160),
  amount: z.number().positive(),
  category: z.string().max(60).optional(),
  spentOn: z.string(), // ISO date string
  notes: z.string().max(2000).optional(),
  neighborhoodId: z.string().optional(),
});

/** All logged expenses for the community — visible to every member for transparency,
 *  same posture as the accounts summary. Only committee/admin can add one (POST). */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req);
  if (guard.error) return guard.error;

  const expenses = await prisma.associationExpense.findMany({
    where: { neighborhoodId: guard.neighborhoodId },
    include: { addedBy: { select: { id: true, name: true } } },
    orderBy: { spentOn: 'desc' },
  });

  return ok(expenses);
}

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please enter a label, a positive amount, and a date.');

  const guard = await requireMembership(req, { neighborhoodId: parsed.data.neighborhoodId, manage: true });
  if (guard.error) return guard.error;

  const { label, amount, category, spentOn, notes } = parsed.data;
  const spentOnDate = new Date(spentOn);
  if (Number.isNaN(spentOnDate.getTime())) return invalidInput('Please enter a valid date.');

  const expense = await prisma.associationExpense.create({
    data: {
      neighborhoodId: guard.neighborhoodId,
      label,
      amount,
      category,
      spentOn: spentOnDate,
      notes,
      addedById: guard.auth.userId,
    },
  });

  return ok(expense, 201);
}
