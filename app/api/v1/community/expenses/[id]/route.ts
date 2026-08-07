import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const patchSchema = z.object({
  label: z.string().min(1).max(160).optional(),
  amount: z.number().positive().optional(),
  category: z.string().max(60).optional(),
  spentOn: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

const notFound = () =>
  NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Expense not found.' } },
    { status: 404 },
  );

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const expense = await prisma.associationExpense.findUnique({ where: { id } });
  if (!expense) return notFound();

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return invalidInput();

  const guard = await requireMembership(req, { neighborhoodId: expense.neighborhoodId, manage: true });
  if (guard.error) return guard.error;

  const { spentOn, ...rest } = parsed.data;
  let spentOnDate: Date | undefined;
  if (spentOn !== undefined) {
    spentOnDate = new Date(spentOn);
    if (Number.isNaN(spentOnDate.getTime())) return invalidInput('Please enter a valid date.');
  }

  const updated = await prisma.associationExpense.update({
    where: { id },
    data: { ...rest, ...(spentOnDate ? { spentOn: spentOnDate } : {}) },
  });

  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const expense = await prisma.associationExpense.findUnique({ where: { id } });
  if (!expense) return notFound();

  const guard = await requireMembership(req, { neighborhoodId: expense.neighborhoodId, manage: true });
  if (guard.error) return guard.error;

  await prisma.associationExpense.delete({ where: { id } });

  return ok(null);
}
