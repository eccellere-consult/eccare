import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { ensureRecurringOrderSuggestions } from '@/lib/recurring-orders';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Auto-heals (creates any newly-due suggestions) on every read, same idiom
 *  as GET /api/v1/health/reminders — no cron/background-job mechanism exists
 *  anywhere in this app, so lazy generation at read time is the established
 *  pattern rather than something new here. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const elderUserId = req.nextUrl.searchParams.get('elderUserId') || auth.userId;
  if (!(await canAccessElder(auth.userId, elderUserId))) {
    return fail('FORBIDDEN', "You don't have access to this elder's reorders.", 403);
  }

  await ensureRecurringOrderSuggestions(elderUserId);

  const suggestions = await prisma.recurringOrderSuggestion.findMany({
    where: { status: 'pendingApproval', template: { elderUserId } },
    include: {
      template: {
        include: {
          catalogItem: { select: { name: true, price: true, inStock: true } },
          provider: { select: { businessName: true } },
        },
      },
    },
    orderBy: { suggestedAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: suggestions });
}
