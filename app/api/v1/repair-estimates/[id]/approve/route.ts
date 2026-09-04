import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireHealthAccess } from '@/lib/health-access';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** The "automated billing loop": approving a repair estimate creates its
 *  PropertyInvoice in the same request, atomically — there's no separate
 *  manual "generate invoice" step for an admin to remember to do. Actual
 *  payment still needs an explicit tap (see /property-invoices/[id]/pay),
 *  same as every other payment in this app — approval only gets the invoice
 *  to a payable state, it doesn't charge anything by itself. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const estimate = await prisma.repairEstimate.findUnique({
    where: { id },
    include: { inspection: { include: { subscription: true } }, invoice: true },
  });
  if (!estimate) return fail('NOT_FOUND', 'Repair estimate not found.', 404);

  const guard = await requireHealthAccess(req, estimate.inspection.subscription.elderUserId);
  if (guard instanceof Response) return guard;

  if (estimate.isApproved && estimate.invoice) {
    return NextResponse.json({ success: true, data: { estimate, invoice: estimate.invoice } });
  }

  const [updatedEstimate, invoice] = await prisma.$transaction([
    prisma.repairEstimate.update({ where: { id }, data: { isApproved: true } }),
    prisma.propertyInvoice.create({ data: { repairEstimateId: id, amount: estimate.estimatedCost } }),
  ]);

  return NextResponse.json({ success: true, data: { estimate: updatedEstimate, invoice } }, { status: 201 });
}
