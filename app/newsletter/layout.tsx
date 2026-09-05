import { AppShell } from '@/components/app-shell';
import { getServerUser } from '@/lib/server-session';
import type { PortalRole } from '@/components/app-shell';

export const dynamic = 'force-dynamic';

/** Same gap as Rentals — no layout at all, so a logged-in visitor never got
 *  the AppShell sidebar/nav. Newsletter is a genuinely public archive
 *  (linked from outside the app too), not in middleware.ts's
 *  PROTECTED_PREFIXES, so an anonymous visitor renders without the shell —
 *  same posture as /login or /terms — while a logged-in visitor gets their
 *  normal portal chrome. */
export default async function NewsletterLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) return <>{children}</>;

  const role: PortalRole = user.role === 'caregiver' ? 'family' : (user.role as PortalRole);

  return (
    <AppShell role={role} userName={user.name}>
      {children}
    </AppShell>
  );
}
