import { prisma } from '@/lib/db';
import { getServerSession } from '@/lib/server-session';
import { ProfileClient } from './profile-client';

export default async function ElderProfilePage() {
  const session = await getServerSession();
  const user = session ? await prisma.user.findUnique({ where: { id: session.userId } }) : null;

  const profile = {
    name: user?.name ?? '',
    phone: user?.phone ?? null,
    bloodGroup: user?.bloodGroup ?? null,
    address: user?.address ?? null,
    city: user?.city ?? null,
    state: user?.state ?? null,
    pincode: user?.pincode ?? null,
  };

  return <ProfileClient profile={profile} />;
}
