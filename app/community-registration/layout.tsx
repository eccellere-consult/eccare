import { AppShell } from '@/components/app-shell';
import { getServerUser } from '@/lib/server-session';
import type { PortalRole } from '@/components/app-shell';

export const dynamic = 'force-dynamic';

/** Same pattern as /pricing, /rentals, /newsletter — genuinely public (not in
 *  middleware.ts's PROTECTED_PREFIXES; deliberately placed outside /community,
 *  which IS protected, since the typical applicant here — a panchayat office,
 *  an RWA committee — has no EC account at all). Anonymous visitor renders
 *  without the shell; a logged-in visitor gets their normal portal chrome. */
export default async function CommunityRegistrationLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) return <>{children}</>;

  const role: PortalRole = user.role === 'caregiver' ? 'family' : (user.role as PortalRole);

  return (
    <AppShell role={role} userName={user.name}>
      {children}
    </AppShell>
  );
}
