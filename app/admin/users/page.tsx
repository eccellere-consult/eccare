import { prisma } from '@/lib/db';
import { getServerUser } from '@/lib/server-session';
import { UsersTable } from '@/components/admin/users-table';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const [users, me] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, name: true, phone: true, email: true, role: true, passwordHash: true, createdAt: true },
    }),
    getServerUser(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Users</h1>
      <p className="mt-1 text-text-secondary">{users.length} accounts on the platform.</p>

      <UsersTable
        // Never send passwordHash itself to the client — only whether one
        // exists, for the "claimed?" check ResetPasswordButton needs.
        users={users.map(({ passwordHash, createdAt, ...u }) => ({ ...u, claimed: !!passwordHash, createdAt: createdAt.toISOString() }))}
        currentUserId={me?.id ?? ''}
      />
    </div>
  );
}
