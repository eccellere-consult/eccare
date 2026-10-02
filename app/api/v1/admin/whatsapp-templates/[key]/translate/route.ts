import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getTemplateDef, getEffectiveTemplates, type WhatsAppTemplateKey } from '@/lib/whatsapp-templates';
import { translateMessage, isTranslationConfigured, TRANSLATION_LANGUAGE_NAMES } from '@/lib/translate-message';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({
  // Languages to produce; absent means all three non-English ones.
  languages: z.array(z.string()).optional(),
  // true: store the results as this template's saved translations right away.
  // false/absent: just return them so the admin can review before saving.
  save: z.boolean().optional(),
});

/** Machine-translates a template's current English wording (the admin's
 *  customised text, or the default if never customised) into Hindi, Kannada
 *  and Malayalam. The source is always read from the database, never taken
 *  from the request, so this can't be used as a free general-purpose
 *  translator. Placeholders are preserved and verified (lib/translate-message.ts). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'admin') return fail('FORBIDDEN', 'Admins only.', 403);

  const { key } = await params;
  try {
    getTemplateDef(key as WhatsAppTemplateKey);
  } catch {
    return fail('NOT_FOUND', 'Unknown message template.', 404);
  }

  if (!isTranslationConfigured()) {
    return fail('NOT_CONFIGURED', 'Automatic translation is not set up on this server (ANTHROPIC_API_KEY is missing).', 503);
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail('VALIDATION', 'Invalid request.', 400);
  const languages = (parsed.data.languages ?? Object.keys(TRANSLATION_LANGUAGE_NAMES)).filter(
    (l) => l in TRANSLATION_LANGUAGE_NAMES,
  );
  if (languages.length === 0) return fail('VALIDATION', 'No valid languages to translate into.', 400);

  const english = (await getEffectiveTemplates('en'))[key as WhatsAppTemplateKey];
  const { translations, failed } = await translateMessage(english, languages);

  if (parsed.data.save && Object.keys(translations).length > 0) {
    const admin = await prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } });
    const meta = { updatedById: auth.userId, updatedByName: admin?.name };
    await Promise.all(
      Object.entries(translations).map(([language, body]) =>
        prisma.whatsAppTemplateTranslation.upsert({
          where: { key_language: { key, language } },
          create: { key, language, body, ...meta },
          update: { body, ...meta },
        }),
      ),
    );
  }

  return NextResponse.json({ success: true, data: { translations, failed, saved: Boolean(parsed.data.save) } });
}
