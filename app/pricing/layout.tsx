import { AppShell } from '@/components/app-shell';
import { getServerUser } from '@/lib/server-session';
import type { PortalRole } from '@/components/app-shell';

export const dynamic = 'force-dynamic';

/** Same pattern as /rentals and /newsletter — a genuinely public page (not in
 *  middleware.ts's PROTECTED_PREFIXES), so an anonymous visitor renders
 *  without the shell while a logged-in visitor gets their normal portal
 *  chrome. */
export default async function PricingLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) return <>{children}</>;

  const role: PortalRole = user.role === 'caregiver' ? 'family' : (user.role as PortalRole);

  return (
    <AppShell role={role} userName={user.name}>
      {children}
    </AppShell>
  );
}
