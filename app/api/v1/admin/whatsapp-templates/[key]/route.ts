import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getTemplateDef, MESSAGE_LANGUAGE_CODES, type WhatsAppTemplateKey } from '@/lib/whatsapp-templates';

type AdminGuard =
  | { error: NextResponse; auth?: never }
  | { error?: never; auth: { userId: string; role: string } };

async function requireAdmin(req: NextRequest): Promise<AdminGuard> {
  const auth = await getAuthUser(req);
  if (!auth) return { error: NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 }) };
  if (auth.role !== 'admin') return { error: NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403 }) };
  return { auth };
}

const schema = z.object({
  body: z.string().trim().min(1).max(4000),
  // Which language this text is for; absent means English (the original behaviour).
  language: z.enum(MESSAGE_LANGUAGE_CODES as [string, ...string[]]).optional(),
});

/** Saves an admin's edited text for one template in one language — English
 *  upserts the row keyed by `key`, any other language upserts its
 *  translation row; either way it's what GET /api/v1/whatsapp-templates
 *  (and so every consumer page) reads next. */
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
  const language = parsed.data.language ?? 'en';
  const meta = { updatedById: auth.userId, updatedByName: admin?.name };

  const saved =
    language === 'en'
      ? await prisma.whatsAppMessageTemplate.upsert({
          where: { key: def.key },
          create: { key: def.key, body: parsed.data.body, ...meta },
          update: { body: parsed.data.body, ...meta },
        })
      : await prisma.whatsAppTemplateTranslation.upsert({
          where: { key_language: { key: def.key, language } },
          create: { key: def.key, language, body: parsed.data.body, ...meta },
          update: { body: parsed.data.body, ...meta },
        });

  return NextResponse.json({ success: true, data: saved });
}

/** Resets one template back to its built-in default by deleting the override
 *  row — `?lang=hi` resets just that language's translation, no param resets
 *  English. A no-op (still success) if it was already using the default. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const guard = await requireAdmin(req);
  if (guard.error) return guard.error;

  const { key } = await params;
  try {
    getTemplateDef(key as WhatsAppTemplateKey);
  } catch {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Unknown message template.' } }, { status: 404 });
  }

  const lang = req.nextUrl.searchParams.get('lang') ?? 'en';
  if (!(MESSAGE_LANGUAGE_CODES as string[]).includes(lang)) {
    return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'Unknown language.' } }, { status: 400 });
  }

  if (lang === 'en') await prisma.whatsAppMessageTemplate.deleteMany({ where: { key } });
  else await prisma.whatsAppTemplateTranslation.deleteMany({ where: { key, language: lang } });

  return NextResponse.json({ success: true, data: { reset: true } });
}
