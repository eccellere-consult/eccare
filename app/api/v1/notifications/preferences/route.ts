import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { NOTIFICATION_CATEGORIES } from '@/lib/notification-categories';

const schema = z.object({
  category: z.enum(['announcements', 'events', 'chat', 'greetings', 'queries']),
  push: z.boolean().optional(),
  email: z.boolean().optional(),
});

const unauthorized = () =>
  NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
    { status: 401 },
  );

/** Current preferences, with defaults filled in for categories never explicitly set. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return unauthorized();

  const saved = await prisma.notificationPreference.findMany({
    where: { userId: auth.userId },
  });
  const byCategory = new Map(saved.map((p) => [p.category, p]));

  return NextResponse.json({
    success: true,
    data: NOTIFICATION_CATEGORIES.map((c) => ({
      ...c,
      push: byCategory.get(c.key)?.push ?? true,
      email: byCategory.get(c.key)?.email ?? false,
    })),
  });
}

export async function PUT(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return unauthorized();

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid notification setting.' } },
      { status: 400 },
    );
  }

  const { category, push, email } = parsed.data;

  const pref = await prisma.notificationPreference.upsert({
    where: { userId_category: { userId: auth.userId, category } },
    create: { userId: auth.userId, category, push: push ?? true, email: email ?? false },
    update: { ...(push !== undefined ? { push } : {}), ...(email !== undefined ? { email } : {}) },
  });

  return NextResponse.json({ success: true, data: pref });
}
