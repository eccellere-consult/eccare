import { AppShell } from '@/components/app-shell';
import { getServerUser } from '@/lib/server-session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();

  return (
    <AppShell role="admin" userName={user?.name}>
      {children}
    </AppShell>
  );
}
