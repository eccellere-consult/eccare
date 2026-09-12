import { AppShell } from '@/components/app-shell';
import { getServerUser } from '@/lib/server-session';
import type { PortalRole } from '@/components/app-shell';
import { CartProvider } from '@/components/cart-context';
import { LanguageProvider } from '@/lib/i18n/language-context';

export const dynamic = 'force-dynamic';

/**
 * Community is shared between elders and family members, so the shell mirrors
 * whichever portal the signed-in user belongs to — they keep their familiar
 * navigation rather than being dropped into a different-looking section.
 *
 * Only elders get wrapped in LanguageProvider (matching app/elder/layout.tsx)
 * — without it, an elder browsing here lost their language entirely: no nav
 * translation, no language toggle button, even though page content is where
 * they came from. Family/admin keep the exact same untranslated shell as
 * before; the community PAGES themselves aren't translated yet either way —
 * this only fixes the shell/nav and makes the toggle available.
 */
export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  const role: PortalRole = user?.role === 'caregiver' ? 'family' : (user?.role as PortalRole) ?? 'elder';

  const shell = (
    <AppShell role={role} userName={user?.name}>
      <CartProvider>{children}</CartProvider>
    </AppShell>
  );

  if (user?.role !== 'elder') return shell;

  return (
    <LanguageProvider language={user.language} secondaryLanguage={user.secondaryLanguage}>
      {shell}
    </LanguageProvider>
  );
}
