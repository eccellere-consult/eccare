import { AppShell } from '@/components/app-shell';
import { getServerUser } from '@/lib/server-session';
import type { PortalRole } from '@/components/app-shell';

export const dynamic = 'force-dynamic';

export default async function GeriatricCareLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  const role: PortalRole = user?.role === 'caregiver' ? 'family' : (user?.role as PortalRole) ?? 'elder';

  return (
    <AppShell role={role} userName={user?.name}>
      {children}
    </AppShell>
  );
}
