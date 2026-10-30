import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiError, apiOk, requireAdmin } from '@/lib/admin-route';
import { checkPublishable, hasBlock } from '@/lib/health-bulletin-rules';

const schema = z.object({ neighborhoodIds: z.array(z.string()).min(1).max(500) });

type Published = { neighborhoodId: string; noticeId: string };

/** Posts the bulletin as a Notice in each chosen community. Safe to call again with more communities —
 *  one it already went to is skipped, never posted twice. The WhatsApp message is not sent from here:
 *  WhatsApp does not let apps post into ordinary groups, so the screen hands the admin a ready-to-send
 *  message instead. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, auth } = await requireAdmin(req);
  if (error) return error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError('INVALID_INPUT', 'Please choose at least one community.');

  const { id } = await params;
  const bulletin = await prisma.healthBulletin.findUnique({ where: { id } });
  if (!bulletin) return apiError('NOT_FOUND', 'Bulletin not found.', 404);
  if (bulletin.status === 'rejected') return apiError('REJECTED', 'This bulletin was rejected.');

  const blocking = checkPublishable(bulletin.title, bulletin.body, bulletin.whatsappText);
  if (hasBlock(blocking)) return apiError('UNSAFE', `Cannot publish: ${blocking.filter((f) => f.level === 'block').map((f) => f.message).join(' ')}`);

  const already = new Set(((bulletin.noticeIds as Published[] | null) ?? []).map((p) => p.neighborhoodId));
  const valid = await prisma.neighborhood.findMany({ where: { id: { in: parsed.data.neighborhoodIds } }, select: { id: true } });
  const targets = valid.map((n) => n.id).filter((nid) => !already.has(nid));
  if (!targets.length) return apiError('NOTHING_TO_DO', 'It has already been published to those communities.');

  const me = await prisma.user.findUnique({ where: { id: auth!.userId }, select: { name: true } });
  const created = await prisma.$transaction(async (tx) => {
    const made: Published[] = [];
    for (const neighborhoodId of targets) {
      const notice = await tx.notice.create({
        data: { neighborhoodId, title: `Health tip: ${bulletin.title}`, body: bulletin.body, pinned: false, createdById: auth!.userId },
      });
      made.push({ neighborhoodId, noticeId: notice.id });
    }
    await tx.healthBulletin.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: bulletin.publishedAt ?? new Date(),
        reviewedById: bulletin.reviewedById ?? auth!.userId,
        reviewedByName: bulletin.reviewedByName ?? me?.name ?? null,
        reviewedAt: bulletin.reviewedAt ?? new Date(),
        noticeIds: [...((bulletin.noticeIds as Published[] | null) ?? []), ...made],
      },
    });
    return made;
  });

  return apiOk({ published: created.length, skipped: parsed.data.neighborhoodIds.length - created.length });
}
