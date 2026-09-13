import { prisma } from '@/lib/db';
import { WHATSAPP_TEMPLATES, type WhatsAppTemplateKey } from '@/lib/whatsapp-templates-shared';

export * from '@/lib/whatsapp-templates-shared';

/** Every template's effective body — a DB row overrides the default,
 *  otherwise the default is used. This is what both the admin editor
 *  (pre-filling "current" alongside "default") and GET
 *  /api/v1/whatsapp-templates (which every consumer page calls) pull from.
 *  Server-only — imports prisma, so never import this file from a client
 *  component; see lib/whatsapp-templates-shared.ts for the client-safe half. */
export async function getEffectiveTemplates(): Promise<Record<WhatsAppTemplateKey, string>> {
  const overrides = await prisma.whatsAppMessageTemplate.findMany();
  const overrideByKey = new Map(overrides.map((o) => [o.key, o.body]));
  const result = {} as Record<WhatsAppTemplateKey, string>;
  for (const def of WHATSAPP_TEMPLATES) {
    result[def.key] = overrideByKey.get(def.key) ?? def.defaultBody;
  }
  return result;
}
