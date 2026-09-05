import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  firmName: z.string().max(160).nullable().optional(),
  phone: z.string().min(3).max(20).optional(),
  email: z.string().email().nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});

/** The caller's own AdvisoryExpert profile — created automatically when
 *  their ServiceProvider account is verified (see admin/providers/[id]), not
 *  by any "join a community" step (advisory isn't community-scoped). */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const expert = await prisma.advisoryExpert.findUnique({ where: { providerId: provider.id } });
  return NextResponse.json({ success: true, data: expert });
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const expert = await prisma.advisoryExpert.findUnique({ where: { providerId: provider.id } });
  if (!expert) return fail('NOT_FOUND', 'Your advisory profile is created once your account is verified.', 404);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please check the details and try again.', 400);

  const updated = await prisma.advisoryExpert.update({ where: { id: expert.id }, data: parsed.data });
  return NextResponse.json({ success: true, data: updated });
}
