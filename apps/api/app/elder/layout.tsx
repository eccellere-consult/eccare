import { AppShell } from '@/components/app-shell';
import { getServerUser } from '@/lib/server-session';

export default async function ElderLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();

  return (
    <AppShell role="elder" userName={user?.name}>
      {children}
    </AppShell>
  );
}
