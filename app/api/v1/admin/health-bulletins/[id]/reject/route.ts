import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiError, apiOk, requireAdmin } from '@/lib/admin-route';

const schema = z.object({ reason: z.string().trim().max(500).optional() });

/** Rejects a draft. Something already published stays published; take its Notices down from the community page. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, auth } = await requireAdmin(req);
  if (error) return error;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return apiError('INVALID_INPUT', 'The reason is too long.');

  const { id } = await params;
  const existing = await prisma.healthBulletin.findUnique({ where: { id } });
  if (!existing) return apiError('NOT_FOUND', 'Bulletin not found.', 404);
  if (existing.status !== 'draft') return apiError('NOT_A_DRAFT', 'Only drafts can be rejected.');

  const me = await prisma.user.findUnique({ where: { id: auth!.userId }, select: { name: true } });
  const updated = await prisma.healthBulletin.update({
    where: { id },
    data: {
      status: 'rejected',
      rejectionReason: parsed.data.reason || 'Rejected by an admin.',
      reviewedById: auth!.userId,
      reviewedByName: me?.name ?? null,
      reviewedAt: new Date(),
    },
  });
  return apiOk(updated);
}
