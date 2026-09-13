import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getTemplateDef, type WhatsAppTemplateKey } from '@/lib/whatsapp-templates';

type AdminGuard =
  | { error: NextResponse; auth?: never }
  | { error?: never; auth: { userId: string; role: string } };

async function requireAdmin(req: NextRequest): Promise<AdminGuard> {
  const auth = await getAuthUser(req);
  if (!auth) return { error: NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 }) };
  if (auth.role !== 'admin') return { error: NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403 }) };
  return { auth };
}

const schema = z.object({ body: z.string().trim().min(1).max(4000) });

/** Saves an admin's edited text for one template — upserts a single
 *  database row keyed by `key`, the same one GET /api/v1/whatsapp-templates
 *  (and every consumer page) reads from. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const guard = await requireAdmin(req);
  if (guard.error) return guard.error;
  const { auth } = guard;

  const { key } = await params;
  let def;
  try {
    def = getTemplateDef(key as WhatsAppTemplateKey);
  } catch {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Unknown message template.' } }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'Please enter some message text.' } }, { status: 400 });
  }

  const admin = await prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } });

  const saved = await prisma.whatsAppMessageTemplate.upsert({
    where: { key: def.key },
    create: { key: def.key, body: parsed.data.body, updatedById: auth.userId, updatedByName: admin?.name },
    update: { body: parsed.data.body, updatedById: auth.userId, updatedByName: admin?.name },
  });

  return NextResponse.json({ success: true, data: saved });
}

/** Resets one template back to its code default by deleting the override row
 *  — a no-op (still success) if it was already using the default. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { key } = await params;
  try {
    getTemplateDef(key as WhatsAppTemplateKey);
  } catch {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Unknown message template.' } }, { status: 404 });
  }

  await prisma.whatsAppMessageTemplate.deleteMany({ where: { key } });
  return NextResponse.json({ success: true, data: { reset: true } });
}
