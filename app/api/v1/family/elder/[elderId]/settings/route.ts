import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { SUPPORTED_LANGUAGE_CODES } from '@/lib/i18n/languages';

const patchSchema = z
  .object({
    language: z.enum(SUPPORTED_LANGUAGE_CODES as [string, ...string[]]),
    secondaryLanguage: z.enum(SUPPORTED_LANGUAGE_CODES as [string, ...string[]]),
  })
  .refine((data) => data.language !== data.secondaryLanguage, {
    message: 'The two languages must be different.',
  });

export async function GET(req: NextRequest, { params }: { params: Promise<{ elderId: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const { elderId } = await params;
  if (!(await canAccessElder(auth.userId, elderId))) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: "You don't have access to this elder." } },
      { status: 403 },
    );
  }

  const elder = await prisma.user.findUnique({
    where: { id: elderId },
    select: { name: true, language: true, secondaryLanguage: true },
  });
  if (!elder) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Elder not found.' } },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: elder });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ elderId: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const { elderId } = await params;
  if (!(await canAccessElder(auth.userId, elderId))) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: "You don't have access to this elder." } },
      { status: 403 },
    );
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Please choose two different languages.' } },
      { status: 400 },
    );
  }

  const elder = await prisma.user.update({
    where: { id: elderId },
    data: { language: parsed.data.language, secondaryLanguage: parsed.data.secondaryLanguage },
    select: { name: true, language: true, secondaryLanguage: true },
  });

  return NextResponse.json({ success: true, data: elder });
}
