import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';

const ok = (data: unknown, status = 200) =>
  NextResponse.json({ success: true, data }, { status });
const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum([
    'self_help_group', 'ngo', 'palliative_care', 'physiotherapy',
    'massage', 'yoga', 'meditation',
  ]).optional(),
  description: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  contactName: z.string().optional(),
  isActive: z.boolean().optional(),
  verified: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const { id } = await params;
  const listing = await prisma.geriatricCareListing.findUnique({
    where: { id },
    include: { addedBy: { select: { name: true } } },
  });
  if (!listing) return fail('NOT_FOUND', 'Listing not found.', 404);

  return ok(listing);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'admin') return fail('FORBIDDEN', 'Admins only.', 403);

  const { id } = await params;
  const existing = await prisma.geriatricCareListing.findUnique({ where: { id } });
  if (!existing) return fail('NOT_FOUND', 'Listing not found.', 404);

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION', parsed.error.errors[0].message);

  const listing = await prisma.geriatricCareListing.update({
    where: { id },
    data: {
      ...parsed.data,
      email: parsed.data.email === '' ? null : parsed.data.email,
      website: parsed.data.website === '' ? null : parsed.data.website,
    },
  });

  return ok(listing);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'admin') return fail('FORBIDDEN', 'Admins only.', 403);

  const { id } = await params;
  const existing = await prisma.geriatricCareListing.findUnique({ where: { id } });
  if (!existing) return fail('NOT_FOUND', 'Listing not found.', 404);

  await prisma.geriatricCareListing.delete({ where: { id } });

  return ok({ deleted: true });
}
