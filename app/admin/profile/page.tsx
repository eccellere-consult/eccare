import { prisma } from '@/lib/db';
import { getServerSession } from '@/lib/server-session';
import { AdminProfileClient } from './profile-client';

export const dynamic = 'force-dynamic';

export default async function AdminProfilePage() {
  const session = await getServerSession();
  const user = session ? await prisma.user.findUnique({ where: { id: session.userId } }) : null;

  const profile = {
    name: user?.name ?? '',
    email: user?.email ?? null,
    phone: user?.phone ?? null,
  };

  return <AdminProfileClient profile={profile} />;
}
