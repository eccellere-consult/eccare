import { prisma } from '@/lib/db';
import {
  WHATSAPP_TEMPLATES,
  MESSAGE_LANGUAGE_CODES,
  getDefaultBody,
  toMessageLanguage,
  type WhatsAppTemplateKey,
  type MessageLanguage,
} from '@/lib/whatsapp-templates-shared';

export * from '@/lib/whatsapp-templates-shared';

/** Every template's effective body in one language. English: the admin's saved
 *  text, else the code default. Other languages: the admin's saved translation,
 *  else the built-in translated default — so a language never comes back empty.
 *  This is what GET /api/v1/whatsapp-templates (which every consumer page
 *  calls) and the admin editor pull from. Server-only — imports prisma, so
 *  never import this file from a client component; see
 *  lib/whatsapp-templates-shared.ts for the client-safe half. */
export async function getEffectiveTemplates(language: string = 'en'): Promise<Record<WhatsAppTemplateKey, string>> {
  const lang = toMessageLanguage(language);
  const overrideByKey = new Map<string, string>();
  if (lang === 'en') {
    for (const o of await prisma.whatsAppMessageTemplate.findMany()) overrideByKey.set(o.key, o.body);
  } else {
    for (const o of await prisma.whatsAppTemplateTranslation.findMany({ where: { language: lang } })) {
      overrideByKey.set(o.key, o.body);
    }
  }
  const result = {} as Record<WhatsAppTemplateKey, string>;
  for (const def of WHATSAPP_TEMPLATES) {
    result[def.key] = overrideByKey.get(def.key) ?? getDefaultBody(def.key, lang);
  }
  return result;
}

/** All languages at once, for pages that compose one message in several
 *  languages (the invite composer). */
export async function getEffectiveTemplatesAllLanguages(): Promise<Record<MessageLanguage, Record<WhatsAppTemplateKey, string>>> {
  const entries = await Promise.all(
    MESSAGE_LANGUAGE_CODES.map(async (code) => [code, await getEffectiveTemplates(code)] as const),
  );
  return Object.fromEntries(entries) as Record<MessageLanguage, Record<WhatsAppTemplateKey, string>>;
}
