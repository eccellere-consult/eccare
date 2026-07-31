import { AppShell } from '@/components/app-shell';
import { getServerUser } from '@/lib/server-session';

export const dynamic = 'force-dynamic';

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();

  return (
    <AppShell role="provider" userName={user?.name}>
      {children}
    </AppShell>
  );
}
