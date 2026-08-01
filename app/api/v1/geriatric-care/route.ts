import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';

const CATEGORIES = [
  'self_help_group',
  'ngo',
  'palliative_care',
  'physiotherapy',
  'massage',
  'yoga',
  'meditation',
] as const;

const createSchema = z.object({
  name: z.string().min(1),
  category: z.enum(CATEGORIES),
  description: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  contactName: z.string().optional(),
});

const ok = (data: unknown, status = 200) =>
  NextResponse.json({ success: true, data }, { status });
const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);

  const category = req.nextUrl.searchParams.get('category');
  const city = req.nextUrl.searchParams.get('city');

  const where: Record<string, unknown> = { isActive: true };
  if (category) where.category = category;
  if (city) where.city = city;

  const listings = await prisma.geriatricCareListing.findMany({
    where,
    include: { addedBy: { select: { name: true } } },
    orderBy: [{ verified: 'desc' }, { name: 'asc' }],
  });

  return ok(listings);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'admin') return fail('FORBIDDEN', 'Admins only.', 403);

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail('VALIDATION', parsed.error.errors[0].message);

  const listing = await prisma.geriatricCareListing.create({
    data: {
      ...parsed.data,
      email: parsed.data.email || null,
      website: parsed.data.website || null,
      addedById: auth.userId,
      verified: true,
    },
  });

  return ok(listing, 201);
}
