import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireHealthAccess, ok, fail } from '@/lib/health-access';
import { sendPushToTokens } from '@/lib/fcm';

const schema = z.object({
  amount: z.number().positive(),
  dueDate: z.string().datetime().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const biller = await prisma.linkedBiller.findUnique({ where: { id } });
  if (!biller) return fail('NOT_FOUND', 'Biller not found.', 404);

  const guard = await requireHealthAccess(req, biller.elderUserId);
  if (guard instanceof Response) return guard;

  const bills = await prisma.billPayment.findMany({ where: { linkedBillerId: id }, orderBy: { createdAt: 'desc' } });
  return ok(bills);
}

/** A caregiver/admin enters a bill amount when one arrives (no real
 *  utility-biller API exists to fetch this automatically). If the biller has
 *  autopay consent on, every linked caregiver gets an immediate push
 *  notification with a direct pay link — the "real-time confirmation alert"
 *  this was scoped as, not a silent auto-debit (see the schema comment on
 *  BillPayment for why). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const biller = await prisma.linkedBiller.findUnique({ where: { id } });
  if (!biller) return fail('NOT_FOUND', 'Biller not found.', 404);

  const guard = await requireHealthAccess(req, biller.elderUserId);
  if (guard instanceof Response) return guard;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please enter a valid bill amount.');

  const bill = await prisma.billPayment.create({
    data: {
      linkedBillerId: id,
      amount: parsed.data.amount,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
    },
  });

  if (biller.autopayEnabled) {
    const caregivers = await prisma.familyRelation.findMany({
      where: { elderUserId: biller.elderUserId, inviteStatus: 'accepted' },
      include: { caregiverUser: { include: { deviceTokens: true } } },
    });
    const tokens = caregivers.flatMap((r) => r.caregiverUser.deviceTokens.map((d) => d.token));
    if (tokens.length) {
      await sendPushToTokens(tokens, {
        title: `New ${biller.billerType.replace('_', ' ')} bill — ${biller.billerName}`,
        body: `₹${parsed.data.amount} due${parsed.data.dueDate ? ` on ${new Date(parsed.data.dueDate).toLocaleDateString('en-IN')}` : ''}. Autopay is on for this biller — tap to pay now.`,
        channelId: 'default',
        data: { type: 'bill_due', billId: bill.id, linkedBillerId: id },
      });
    }
  }

  return ok(bill, 201);
}
