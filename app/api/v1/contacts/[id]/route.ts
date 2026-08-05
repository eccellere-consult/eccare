import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';

const patchSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  phone: z.string().min(3).max(20).optional(),
  providerType: z.string().max(60).optional(),
  notes: z.string().max(2000).optional(),
  // Only meaningful when the contact's category is 'neighbor' — toggles whether it
  // appears in the community "Your neighbours" directory. Silently ignored server-side
  // for other categories rather than rejected, since it's harmless either way.
  shareWithNeighbours: z.boolean().optional(),
});

async function loadOwnedContact(auth: { userId: string }, id: string) {
  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) return { error: NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Contact not found.' } },
    { status: 404 },
  ) };

  if (!(await canAccessElder(auth.userId, contact.elderUserId))) {
    return { error: NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: "You don't have access to this contact." } },
      { status: 403 },
    ) };
  }

  return { contact };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const { id } = await params;
  const { contact, error } = await loadOwnedContact(auth, id);
  if (error) return error;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Please check the details and try again.' } },
      { status: 400 },
    );
  }

  const data = { ...parsed.data };
  if (data.shareWithNeighbours !== undefined && contact!.category !== 'neighbor') {
    delete data.shareWithNeighbours;
  }

  const updated = await prisma.contact.update({ where: { id }, data });

  return NextResponse.json({ success: true, data: updated });
}

/** Removes only the personal contact — never the linked community LocalListing, if
 *  one exists. Other residents may already be relying on that entry; removing it from
 *  the community directory is a separate, committee/admin-only action. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const { id } = await params;
  const { error } = await loadOwnedContact(auth, id);
  if (error) return error;

  await prisma.contact.delete({ where: { id } });

  return NextResponse.json({ success: true, data: null });
}
