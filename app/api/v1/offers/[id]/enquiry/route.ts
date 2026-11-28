import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { isShowing } from '@/lib/campaigns';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({
  message: z.string().trim().min(2).max(1000),
  // The phone number is shared with the provider only when the person ticks this.
  sharePhone: z.boolean().default(false),
});

/** An elder or family member asks the provider about an offer. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('INVALID_INPUT', 'Please write your question.', 400);

  const campaign = await prisma.campaign.findUnique({ where: { id }, select: { status: true, startsAt: true, endsAt: true } });
  if (!campaign || !isShowing(campaign, new Date())) return fail('NOT_FOUND', 'This offer has ended.', 404);

  const recent = await prisma.campaignEnquiry.count({
    where: { userId: auth.userId, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= 10) return fail('TOO_MANY', 'You have sent many questions this hour. Please try again later.', 429);

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true, phone: true } });
  if (!user) return fail('UNAUTHORIZED', 'Please log in.', 401);
  await prisma.campaignEnquiry.create({
    data: {
      campaignId: id,
      userId: auth.userId,
      name: user.name,
      phone: parsed.data.sharePhone ? user.phone : null,
      message: parsed.data.message,
    },
  });
  return NextResponse.json({ success: true, data: { sent: true } }, { status: 201 });
}
