import Link from 'next/link';
import { Users, AlertTriangle, Kanban, Building2, Briefcase, type LucideIcon } from 'lucide-react';
import { prisma } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

const SECTIONS: { href: string; label: string; description: string; icon: LucideIcon }[] = [
  { href: '/admin/users', label: 'Users', description: 'Every account on the platform', icon: Users },
  { href: '/admin/communities', label: 'Communities', description: 'Create and manage neighbourhoods', icon: Building2 },
  { href: '/admin/providers', label: 'Providers', description: 'Review and verify service providers', icon: Briefcase },
  { href: '/admin/sos-feed', label: 'SOS feed', description: 'Every emergency alert, newest first', icon: AlertTriangle },
  { href: '/admin/backlog', label: 'Backlog', description: 'Product roadmap Kanban board', icon: Kanban },
];

export default async function AdminHomePage() {
  const [userCount, communityCount, openSos, pendingProviders] = await Promise.all([
    prisma.user.count(),
    prisma.neighborhood.count(),
    prisma.sOSEvent.count({ where: { status: { not: 'resolved' } } }),
    prisma.serviceProvider.count({ where: { verificationStatus: 'pending' } }),
  ]);

  const stats = [
    { label: 'Users', value: userCount },
    { label: 'Communities', value: communityCount },
    { label: 'Unresolved SOS', value: openSos, alert: openSos > 0 },
    { label: 'Pending providers', value: pendingProviders, alert: pendingProviders > 0 },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Admin</h1>
      <p className="mt-1 text-text-secondary">Platform overview and management.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <p className={`text-3xl font-black ${s.alert ? 'text-danger-600' : 'text-text'}`}>
                {s.value}
              </p>
              <p className="mt-1 text-sm text-text-secondary">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="flex h-full items-center gap-4 p-5 transition-shadow hover:shadow-md">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
                <Icon className="h-6 w-6 text-primary-600" />
              </span>
              <span>
                <span className="block font-bold text-text">{label}</span>
                <span className="block text-sm text-text-secondary">{description}</span>
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
