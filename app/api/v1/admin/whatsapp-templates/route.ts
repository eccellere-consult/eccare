import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { WHATSAPP_TEMPLATES } from '@/lib/whatsapp-templates';

async function requireAdmin(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return { error: NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 }) };
  if (auth.role !== 'admin') return { error: NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403 }) };
  return { auth };
}

/** Full list for the admin editor — label/description/defaultBody from code,
 *  plus whatever's actually in the database for each key. */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const overrides = await prisma.whatsAppMessageTemplate.findMany();
  const overrideByKey = new Map(overrides.map((o) => [o.key, o]));

  const data = WHATSAPP_TEMPLATES.map((def) => {
    const override = overrideByKey.get(def.key);
    return {
      key: def.key,
      label: def.label,
      description: def.description,
      defaultBody: def.defaultBody,
      body: override?.body ?? def.defaultBody,
      isCustomized: Boolean(override),
      updatedByName: override?.updatedByName ?? null,
      updatedAt: override?.updatedAt ?? null,
    };
  });

  return NextResponse.json({ success: true, data });
}
