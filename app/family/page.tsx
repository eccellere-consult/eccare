import Link from 'next/link';
import { UserPlus, Clock } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getServerSession } from '@/lib/server-session';
import { getFamilySubscriptionState } from '@/lib/family-subscription';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmergencyActions } from '@/components/emergency-actions';
import { FamilyDashboardElderCard } from './family-dashboard-elder-card';

export const dynamic = 'force-dynamic';

export default async function FamilyDashboard() {
  const session = await getServerSession();
  const relations = session
    ? await prisma.familyRelation.findMany({
        where: { caregiverUserId: session.userId },
        include: { elderUser: true },
        orderBy: { createdAt: 'desc' },
      })
    : [];
  const subscription = session ? await getFamilySubscriptionState(session.userId) : null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Your family</h1>
          <p className="mt-1 text-text-secondary">Elders you're connected with on EC.</p>
        </div>
        <Button asChild>
          <Link href="/family/invite">
            <UserPlus className="h-5 w-5" />
            Invite an elder
          </Link>
        </Button>
      </div>

      {/* A caregiver's OWN account, not per-elder — expired is already hard-blocked
          at the layout level by FamilySubscriptionGate, so only the "still time
          left" trial case needs a nudge here. */}
      {subscription?.status === 'trialing' && subscription.trialEndsAt && (
        <Card className="mt-4 border-accent-100 bg-accent-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm font-semibold text-accent-900">
              Your free trial ends {subscription.trialEndsAt.toLocaleDateString()}.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/family/payments">Manage billing</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* The caregiver's own emergency actions — mirrors the elder's home hub,
          not per-elder (a caregiver can be at risk too, and this always acts
          as "the caller" already). */}
      <div className="mt-6">
        <EmergencyActions />
      </div>

      {relations.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-50">
              <UserPlus className="h-8 w-8 text-primary-600" />
            </div>
            <CardTitle>No elders linked yet</CardTitle>
            <CardDescription>Invite an elder by phone number to get started.</CardDescription>
            <Button asChild className="mt-2">
              <Link href="/family/invite">Invite an elder</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {relations.map((rel) =>
            rel.inviteStatus === 'accepted' ? (
              <FamilyDashboardElderCard
                key={rel.id}
                elderId={rel.elderUserId}
                elderName={rel.elderUser.name}
                phone={rel.elderUser.phone}
                relationship={rel.relationship}
                connectedSince={rel.createdAt.toLocaleDateString()}
              />
            ) : (
              <Card key={rel.id}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>{rel.elderUser.name}</CardTitle>
                    <CardDescription>{rel.relationship}</CardDescription>
                  </div>
                  <Badge variant="muted">Pending</Badge>
                </CardHeader>
                <CardContent className="flex items-center gap-4 text-sm text-text-secondary">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    Invited {rel.createdAt.toLocaleDateString()}
                  </span>
                </CardContent>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  );
}
