import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const patchSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  reply: z.string().min(1).max(8000).optional(),
});

const notFound = () =>
  NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Query not found.' } },
    { status: 404 },
  );

const forbidden = () =>
  NextResponse.json(
    { success: false, error: { code: 'FORBIDDEN', message: 'You cannot view this query.' } },
    { status: 403 },
  );

/** A single query thread with its replies. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const query = await prisma.committeeQuery.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      replies: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!query) return notFound();

  const guard = await requireMembership(req, { neighborhoodId: query.neighborhoodId });
  if (guard.error) return guard.error;

  // Authors can always see their own; everyone else needs committee standing.
  const isAuthor = query.userId === guard.auth.userId;
  if (!isAuthor && guard.membership.role === 'member') return forbidden();

  return ok(query);
}

/** Reply to a query and/or change its status. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return invalidInput();

  const query = await prisma.committeeQuery.findUnique({ where: { id } });
  if (!query) return notFound();

  const guard = await requireMembership(req, { neighborhoodId: query.neighborhoodId });
  if (guard.error) return guard.error;

  const isAuthor = query.userId === guard.auth.userId;
  const isCommittee = guard.membership.role !== 'member';
  if (!isAuthor && !isCommittee) return forbidden();

  const { status, reply } = parsed.data;

  // Only the committee can change a ticket's status — otherwise a resident could mark
  // their own unresolved complaint as resolved, or reopen one indefinitely.
  if (status && !isCommittee) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the committee can change the status.' },
      },
      { status: 403 },
    );
  }

  if (reply) {
    await prisma.committeeQueryReply.create({
      data: { queryId: id, userId: guard.auth.userId, body: reply },
    });
  }

  const updated = await prisma.committeeQuery.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      // Any reply on an untouched ticket moves it out of "open" so the committee's
      // queue reflects what's actually been picked up.
      ...(reply && !status && query.status === 'open' && isCommittee
        ? { status: 'in_progress' as const }
        : {}),
    },
    include: {
      user: { select: { id: true, name: true } },
      replies: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return ok(updated);
}
