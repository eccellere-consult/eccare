import { prisma } from '@/lib/db';
import { getServerSession } from '@/lib/server-session';
import { FamilyProfileClient } from './profile-client';

export const dynamic = 'force-dynamic';

export default async function FamilyProfilePage() {
  const session = await getServerSession();
  const user = session ? await prisma.user.findUnique({ where: { id: session.userId } }) : null;

  const profile = {
    name: user?.name ?? '',
    email: user?.email ?? null,
    phone: user?.phone ?? null,
    address: user?.address ?? null,
    city: user?.city ?? null,
    state: user?.state ?? null,
    pincode: user?.pincode ?? null,
  };

  return <FamilyProfileClient profile={profile} />;
}
