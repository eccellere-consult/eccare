import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';
import { linkPlaceholderToMember } from '@/lib/directory-link';

const notFound = () =>
  NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Match not found.' } }, { status: 404 });

const schema = z.object({ action: z.enum(['link', 'reject']) });

/** The committee's decision on one possible match. "link" says it IS the same
 *  person — the directory entry is claimed by that account (and its house number
 *  carried over if the member never gave one). "reject" says it isn't, and the
 *  decision is kept so the same pair is never raised again. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const suggestion = await prisma.directoryMatchSuggestion.findUnique({ where: { id } });
  if (!suggestion || suggestion.status !== 'pending') return notFound();

  const guard = await requireMembership(req, { neighborhoodId: suggestion.neighborhoodId, manage: true });
  if (guard.error) return guard.error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidInput();

  if (parsed.data.action === 'link') {
    const linked = await linkPlaceholderToMember(suggestion.placeholderId, suggestion.neighborhoodId, suggestion.userId);
    if (!linked) {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_LINKED', message: 'That directory entry has already been linked to someone.' } },
        { status: 409 },
      );
    }
    await prisma.directoryMatchSuggestion.update({
      where: { id },
      data: { status: 'linked', decidedById: guard.auth.userId, decidedAt: new Date() },
    });
    return ok({ status: 'linked' });
  }

  await prisma.directoryMatchSuggestion.update({
    where: { id },
    data: { status: 'rejected', decidedById: guard.auth.userId, decidedAt: new Date() },
  });
  return ok({ status: 'rejected' });
}
