import { AppShell } from '@/components/app-shell';
import { getServerUser } from '@/lib/server-session';
import type { PortalRole } from '@/components/app-shell';
import { CartProvider } from '@/components/cart-context';

export const dynamic = 'force-dynamic';

/**
 * Community is shared between elders and family members, so the shell mirrors
 * whichever portal the signed-in user belongs to — they keep their familiar
 * navigation rather than being dropped into a different-looking section.
 */
export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  const role: PortalRole = user?.role === 'caregiver' ? 'family' : (user?.role as PortalRole) ?? 'elder';

  return (
    <AppShell role={role} userName={user?.name}>
      <CartProvider>{children}</CartProvider>
    </AppShell>
  );
}
