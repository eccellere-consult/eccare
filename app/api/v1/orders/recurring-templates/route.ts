import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const elderUserId = req.nextUrl.searchParams.get('elderUserId') || auth.userId;
  if (!(await canAccessElder(auth.userId, elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this elder's reorders.", 403);
  }

  // Includes paused (isActive: false) templates too — the frontend needs them
  // to offer a "Resume" action; ensureRecurringOrderSuggestions is what
  // actually respects isActive when deciding what to suggest next.
  const templates = await prisma.recurringOrderTemplate.findMany({
    where: { elderUserId },
    include: { catalogItem: { select: { name: true, price: true } }, provider: { select: { businessName: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: templates });
}

const schema = z.object({
  elderUserId: z.string().optional(),
  providerId: z.string(),
  catalogItemId: z.string(),
  medicationId: z.string().optional(),
  unitsPerMonth: z.number().int().min(1).max(999),
});

/** Explicit manual setup — most templates instead get created via the quicker
 *  "Set up monthly reorder" action on a past order (see
 *  POST .../recurring-templates/from-order), which defaults unitsPerMonth
 *  from what was actually ordered last time. This route stays for setting
 *  one up without a prior order to base it on. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please check the details and try again.', 400);

  const elderUserId = parsed.data.elderUserId || auth.userId;
  if (!(await canAccessElder(auth.userId, elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to order for this elder.", 403);
  }

  const catalogItem = await prisma.catalogItem.findUnique({ where: { id: parsed.data.catalogItemId } });
  if (!catalogItem || catalogItem.providerId !== parsed.data.providerId) {
    return fail('NOT_FOUND', 'Item not found for this provider.', 404);
  }

  // No natural unique key was added to the schema for this (elderUserId,
  // catalogItemId) pair (kept simple, single-writer flows only) — a plain
  // findFirst-then-create-or-update instead of a compound-unique upsert.
  const existing = await prisma.recurringOrderTemplate.findFirst({
    where: { elderUserId, catalogItemId: parsed.data.catalogItemId, isActive: true },
  });
  const template = existing
    ? await prisma.recurringOrderTemplate.update({
        where: { id: existing.id },
        data: { unitsPerMonth: parsed.data.unitsPerMonth, medicationId: parsed.data.medicationId },
      })
    : await prisma.recurringOrderTemplate.create({
        data: {
          elderUserId,
          providerId: parsed.data.providerId,
          catalogItemId: parsed.data.catalogItemId,
          medicationId: parsed.data.medicationId,
          unitsPerMonth: parsed.data.unitsPerMonth,
        },
      });

  return NextResponse.json({ success: true, data: template }, { status: 201 });
}
