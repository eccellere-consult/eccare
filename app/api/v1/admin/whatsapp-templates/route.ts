import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { WHATSAPP_TEMPLATES, MESSAGE_LANGUAGE_CODES, getDefaultBody } from '@/lib/whatsapp-templates';

async function requireAdmin(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return { error: NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 }) };
  if (auth.role !== 'admin') return { error: NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403 }) };
  return { auth };
}

/** Full list for the admin editor — label/description from code, and for each
 *  language (English plus the translations) the current text, the built-in
 *  default, and whether an admin has customised it. The top-level body /
 *  defaultBody / isCustomized fields are the English ones, kept so anything
 *  reading the old shape still works. */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const [overrides, translations] = await Promise.all([
    prisma.whatsAppMessageTemplate.findMany(),
    prisma.whatsAppTemplateTranslation.findMany(),
  ]);
  const overrideByKey = new Map(overrides.map((o) => [o.key, o]));
  const translationByKey = new Map(translations.map((t) => [`${t.key}:${t.language}`, t]));

  const data = WHATSAPP_TEMPLATES.map((def) => {
    const languages = Object.fromEntries(
      MESSAGE_LANGUAGE_CODES.map((code) => {
        const row = code === 'en' ? overrideByKey.get(def.key) : translationByKey.get(`${def.key}:${code}`);
        const defaultBody = getDefaultBody(def.key, code);
        return [
          code,
          {
            body: row?.body ?? defaultBody,
            defaultBody,
            isCustomized: Boolean(row),
            updatedByName: row?.updatedByName ?? null,
            updatedAt: row?.updatedAt ?? null,
          },
        ];
      }),
    );
    return {
      key: def.key,
      label: def.label,
      description: def.description,
      defaultBody: def.defaultBody,
      body: languages.en.body,
      isCustomized: languages.en.isCustomized,
      updatedByName: languages.en.updatedByName,
      updatedAt: languages.en.updatedAt,
      languages,
    };
  });

  return NextResponse.json({ success: true, data });
}
