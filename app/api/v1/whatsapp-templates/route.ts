import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getEffectiveTemplates } from '@/lib/whatsapp-templates';

/** Read-only, any authenticated user — every page that pre-fills a wa.me
 *  message (auto-booking, doctor booking, the emergency Police button, the
 *  admin invite composer) calls this to get the current effective body per
 *  template key, then fills in its own {{placeholders}} via renderTemplate().
 *  Editing lives under /api/v1/admin/whatsapp-templates (admin-only). */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 });
  }

  const templates = await getEffectiveTemplates();
  return NextResponse.json({ success: true, data: templates });
}
