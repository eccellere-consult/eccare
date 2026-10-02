import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getEffectiveTemplates, getEffectiveTemplatesAllLanguages } from '@/lib/whatsapp-templates';

/** Read-only, any authenticated user — every page that pre-fills a wa.me
 *  message (auto-booking, doctor booking, the emergency buttons, the admin
 *  invite composer) calls this to get the current effective body per template
 *  key, then fills in its own {{placeholders}} via renderTemplate().
 *
 *  `?lang=hi` (en/hi/kn/ml) returns that language's wording; no param is
 *  English, so already-installed mobile builds keep working unchanged.
 *  `?lang=all` returns { en: {...}, hi: {...}, ... } for pages that combine
 *  languages in one message. Editing lives under
 *  /api/v1/admin/whatsapp-templates (admin-only). */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 });
  }

  const lang = req.nextUrl.searchParams.get('lang') ?? 'en';
  const templates = lang === 'all' ? await getEffectiveTemplatesAllLanguages() : await getEffectiveTemplates(lang);
  return NextResponse.json({ success: true, data: templates });
}
