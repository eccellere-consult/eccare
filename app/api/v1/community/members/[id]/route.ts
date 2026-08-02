import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';

const schema = z.object({ role: z.enum(['member', 'committee', 'admin']) });

const forbidden = (message: string) =>
  NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message } }, { status: 403 });

const notFound = () =>
  NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Member not found.' } },
    { status: 404 },
  );

/**
 * Change a member's role within their community. Promoting a resident to
 * `committee` (or demoting them back) is something any committee/admin
 * member can do — that's the whole point of this route, since nothing
 * elsewhere lets a community self-manage who's on its committee. Granting or
 * removing `admin` status is more sensitive — that's restricted to existing
 * admins (a community's own admin-role member, or a platform admin acting
 * through the requireMembership() bypass) — and a community can never be
 * left with zero admins, or nobody could manage it again.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return invalidInput('Please choose a valid role.');

  const { id } = await params;
  const target = await prisma.neighborhoodMember.findUnique({ where: { id } });
  if (!target) return notFound();

  const guard = await requireMembership(req, { manage: true, neighborhoodId: target.neighborhoodId });
  if (guard.error) return guard.error;

  const callerIsAdminTier = guard.membership.role === 'admin';
  const touchesAdmin = parsed.data.role === 'admin' || target.role === 'admin';
  if (touchesAdmin && !callerIsAdminTier) {
    return forbidden('Only a community admin can grant or remove admin status.');
  }

  if (target.role === 'admin' && parsed.data.role !== 'admin') {
    const otherAdmins = await prisma.neighborhoodMember.count({
      where: { neighborhoodId: target.neighborhoodId, role: 'admin', id: { not: target.id } },
    });
    if (otherAdmins === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LAST_ADMIN',
            message: 'A community must keep at least one admin. Promote someone else to admin first.',
          },
        },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.neighborhoodMember.update({
    where: { id },
    data: { role: parsed.data.role },
    include: { user: { select: { id: true, name: true, phone: true } } },
  });

  return ok(updated);
}
