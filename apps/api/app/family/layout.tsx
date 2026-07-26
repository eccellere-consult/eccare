import { AppShell } from '@/components/app-shell';
import { getServerUser } from '@/lib/server-session';

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();

  return (
    <AppShell role="family" userName={user?.name}>
      {children}
    </AppShell>
  );
}
