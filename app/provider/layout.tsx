import { AppShell } from '@/components/app-shell';
import { getServerUser } from '@/lib/server-session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  // Drives which nav items show — see getProviderNavItems in app-shell.tsx.
  // Selecting just the one column avoids fetching (and re-serializing) the
  // whole ServiceProvider row purely to read its category here.
  const provider = user
    ? await prisma.serviceProvider.findUnique({ where: { userId: user.id }, select: { category: true } })
    : null;

  return (
    <AppShell role="provider" userName={user?.name} providerCategory={provider?.category}>
      {children}
    </AppShell>
  );
}
