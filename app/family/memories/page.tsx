import Link from 'next/link';
import { Camera, User } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getServerSession } from '@/lib/server-session';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

/** Same "Myself" + per-elder tile pattern as app/family/health/page.tsx —
 *  app/api/v1/memories/route.ts already accepts and defaults elderUserId to
 *  the caller, and app/family/memories/[elderId]/page.tsx already accepts any
 *  id, so this needed no backend change, just the missing "Myself" tile. */
export default async function FamilyMemoriesPicker() {
  const session = await getServerSession();
  const relations = session
    ? await prisma.familyRelation.findMany({
        where: { caregiverUserId: session.userId, inviteStatus: 'accepted' },
        include: { elderUser: { select: { id: true, name: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Memories</h1>
      <p className="mt-1 text-text-secondary">Choose whose shared photos to view or add to.</p>

      {!session ? null : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link href={`/family/memories/${session.userId}`}>
            <Card className="border-accent-100 bg-accent-50 transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface">
                  <User className="h-6 w-6 text-accent-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-text">Myself</p>
                  <p className="text-sm text-text-secondary">Your own shared photos</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {relations.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
                  <Camera className="h-6 w-6 text-primary-600" />
                </div>
                <p className="text-sm text-text-secondary">Invite an elder to also share memories with them.</p>
              </CardContent>
            </Card>
          )}

          {relations.map((rel) => (
            <Link key={rel.id} href={`/family/memories/${rel.elderUser.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
                    <Camera className="h-6 w-6 text-primary-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-text">{rel.elderUser.name}</p>
                    <p className="text-sm text-text-secondary">{rel.elderUser.phone}</p>
                  </div>
                  {rel.relationship && (
                    <Badge variant="muted" className="ml-auto">{rel.relationship}</Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
