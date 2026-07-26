import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getServerSession } from '@/lib/server-session';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ContactsManager } from './contacts-manager';

export default async function FamilyContactsPage() {
  const session = await getServerSession();

  const relation = session
    ? await prisma.familyRelation.findFirst({
        where: { caregiverUserId: session.userId, inviteStatus: 'accepted' },
        include: { elderUser: true },
      })
    : null;

  if (!relation) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <CardTitle>No elder connected yet</CardTitle>
          <CardDescription>Invite an elder to start managing their emergency contacts.</CardDescription>
          <Button asChild className="mt-2">
            <Link href="/family/invite">Invite an elder</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <ContactsManager elderUserId={relation.elderUserId} elderName={relation.elderUser.name} />;
}
