import { prisma } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const ROLE_VARIANT = {
  elder: 'default',
  caregiver: 'accent',
  admin: 'muted',
  provider: 'success',
} as const;

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Users</h1>
      <p className="mt-1 text-text-secondary">{users.length} accounts on the platform.</p>

      <Card className="mt-6">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-semibold text-text">{user.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{user.phone ?? user.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={ROLE_VARIANT[user.role]}>{user.role}</Badge>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{user.createdAt.toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
