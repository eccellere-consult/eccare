import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const patchSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  city: z.string().max(80).optional(),
  pincode: z.string().max(12).optional(),
  description: z.string().max(2000).optional(),
});

const forbidden = () =>
  NextResponse.json(
    { success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } },
    { status: 403 },
  );

const notFound = () =>
  NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Community not found.' } },
    { status: 404 },
  );

async function requireAdmin(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return {
      error: NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
        { status: 401 },
      ),
    };
  }
  if (auth.role !== 'admin') return { error: forbidden() };
  return { auth };
}

/** Platform admin: a single community's detail, with counts across every content type
 *  it owns — this is what the admin drill-in page's Overview tab renders. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { id } = await params;
  const neighborhood = await prisma.neighborhood.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          members: true,
          events: true,
          helplines: true,
          listings: true,
          queries: true,
          notices: true,
          whatsAppGroups: true,
        },
      },
    },
  });
  if (!neighborhood) return notFound();

  return NextResponse.json({ success: true, data: neighborhood });
}

/** Platform admin: rename/re-describe a community. No DELETE — deleting a
 *  neighborhood would cascade-remove essentially its entire resident-authored
 *  history (members, events, helplines, vendors, queries, notices, chat), which is
 *  too large a blast radius for a single admin action without a much more
 *  deliberate confirmation flow than this pass warrants. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Please check the details and try again.' } },
      { status: 400 },
    );
  }

  const { id } = await params;
  const existing = await prisma.neighborhood.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return notFound();

  const neighborhood = await prisma.neighborhood.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ success: true, data: neighborhood });
}
