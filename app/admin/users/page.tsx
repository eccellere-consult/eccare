import { prisma } from '@/lib/db';
import { getServerUser } from '@/lib/server-session';
import { UsersTable } from '@/components/admin/users-table';
import { communityHousePrefix } from '@/lib/house-location';

export const dynamic = 'force-dynamic';

type View = 'all' | 'unassigned' | 'waiting';

/** Only elders and family members belong to communities. */
const JOINABLE = { role: { in: ['elder', 'caregiver'] as ('elder' | 'caregiver')[] } };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const view: View = show === 'unassigned' || show === 'waiting' ? show : 'all';

  // "Not in a community": registered, but no membership at all (a rejected one doesn't count).
  // "Waiting": has asked to join somewhere and nobody has approved it yet.
  const unassignedWhere = { ...JOINABLE, memberships: { none: { status: { in: ['approved', 'pending'] as ('approved' | 'pending')[] } } } };
  const waitingWhere = { ...JOINABLE, memberships: { some: { status: 'pending' as const }, none: { status: 'approved' as const } } };

  const [users, me, unassignedCount, waitingCount, hoods] = await Promise.all([
    prisma.user.findMany({
      where: view === 'unassigned' ? unassignedWhere : view === 'waiting' ? waitingWhere : undefined,
      orderBy: { createdAt: 'desc' },
      take: view === 'all' ? 100 : 300,
      select: {
        id: true, name: true, phone: true, email: true, role: true, passwordHash: true, createdAt: true, dateOfBirth: true, caregiverException: true,
        memberships: {
          where: { status: { in: ['approved', 'pending'] } },
          select: { status: true, flatNumber: true, neighborhood: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    getServerUser(),
    prisma.user.count({ where: unassignedWhere }),
    prisma.user.count({ where: waitingWhere }),
    prisma.neighborhood.findMany({
      select: { id: true, name: true, city: true, pincode: true, housePrefix: true, members: { where: { status: 'approved' }, select: { flatNumber: true } } },
      orderBy: { name: 'asc' },
    }),
  ]);

  const communities = hoods.map((h) => ({
    id: h.id,
    name: h.name,
    place: [h.city, h.pincode].filter(Boolean).join(' · '),
    members: h.members.length,
    housePrefix: communityHousePrefix(h.housePrefix, h.members.map((m) => m.flatNumber)),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Users</h1>
      <p className="mt-1 text-text-secondary">
        {users.length} account{users.length === 1 ? '' : 's'} shown
        {view === 'all' ? ' (the newest 100)' : ''}.
      </p>

      <UsersTable
        // Never send passwordHash itself to the client — only whether one
        // exists, for the "claimed?" check ResetPasswordButton needs.
        users={users.map(({ passwordHash, createdAt, dateOfBirth, memberships, ...u }) => ({
          ...u,
          claimed: !!passwordHash,
          createdAt: createdAt.toISOString(),
          dateOfBirth: dateOfBirth ? dateOfBirth.toISOString().slice(0, 10) : null,
          memberships: memberships.map((m) => ({
            status: m.status as 'approved' | 'pending',
            house: m.flatNumber,
            communityId: m.neighborhood.id,
            communityName: m.neighborhood.name,
          })),
        }))}
        currentUserId={me?.id ?? ''}
        communities={communities}
        view={view}
        counts={{ unassigned: unassignedCount, waiting: waitingCount }}
      />
    </div>
  );
}
