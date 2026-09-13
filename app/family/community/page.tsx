import { prisma } from '@/lib/db';
import { getServerUser } from '@/lib/server-session';
import { ElderCommunityView } from './elder-community-view';

export const dynamic = 'force-dynamic';

/** Read-only "For [Elder]" slice of Community — announcements + directory only,
 *  per the Phase 2 plan's explicit scope (no posting, managing, or RSVPing "as"
 *  the elder). A caregiver's OWN community membership is a separate, much
 *  fuller experience at /community; this page never duplicates that — it only
 *  ever shows the elder's side, and links out to /community for the
 *  caregiver's own. Deliberately not the same elder/self toggle used on
 *  Contacts/Orders/Payments/Services: those two "communities" aren't
 *  equivalent surfaces (this one is a two-tab read-only slice, /community is
 *  the full membership experience), so presenting them as interchangeable
 *  tabs would be misleading. */
export default async function FamilyCommunityPage() {
  const user = await getServerUser();
  if (!user) return null;

  const relation = await prisma.familyRelation.findFirst({
    where: { caregiverUserId: user.id, inviteStatus: 'accepted' },
    include: { elderUser: true },
  });

  if (!relation) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text">Elder&rsquo;s Community</h1>
        <p className="mt-2 text-text-secondary">
          Once you&rsquo;re linked with an elder, their community announcements and
          neighbour directory will show up here, read-only.
        </p>
      </div>
    );
  }

  return <ElderCommunityView elderName={relation.elderUser.name} elderUserId={relation.elderUserId} />;
}
