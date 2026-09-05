import { AppShell } from '@/components/app-shell';
import { getServerUser } from '@/lib/server-session';
import type { PortalRole } from '@/components/app-shell';

export const dynamic = 'force-dynamic';

/** Rentals is role-agnostic (elder/family/admin/provider all browse and
 *  inquire) but had no layout at all, so a logged-in visitor never got the
 *  AppShell — no sidebar/nav, content spread full-width instead of sitting
 *  inside the shell's content area. Unlike /services, Rentals isn't in
 *  middleware.ts's PROTECTED_PREFIXES (browsing is intentionally open to
 *  anonymous visitors too — only submitting an inquiry needs a real
 *  account), so this can't assume getServerUser() always returns someone
 *  the way services/layout.tsx does; an anonymous visitor renders without
 *  the shell, same plain-page posture as /login or /terms. */
export default async function RentalsLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) return <>{children}</>;

  const role: PortalRole = user.role === 'caregiver' ? 'family' : (user.role as PortalRole);

  return (
    <AppShell role={role} userName={user.name}>
      {children}
    </AppShell>
  );
}
