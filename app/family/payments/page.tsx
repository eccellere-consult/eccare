import { prisma } from '@/lib/db';
import { getServerUser } from '@/lib/server-session';
import { PaymentsTabs } from './payments-tabs';

export const dynamic = 'force-dynamic';

/** Same "For [Elder] / For myself" pattern as app/family/contacts/page.tsx —
 *  replaces the old picker page + /family/payments/[elderId] dynamic route
 *  (a single route now, matching Contacts' shape). GET
 *  /api/v1/community/fee-charges already defaults to the caller's own id and
 *  canAccessElder(callerId, callerId) already returns true, so this needed
 *  no backend change. "For myself" here means the caregiver's own community
 *  dues if they belong to a neighbourhood — PaymentsDue already renders an
 *  honest empty state if they don't. */
export default async function FamilyPaymentsPage() {
  const user = await getServerUser();
  if (!user) return null;

  const relation = await prisma.familyRelation.findFirst({
    where: { caregiverUserId: user.id, inviteStatus: 'accepted' },
    include: { elderUser: true },
  });

  return (
    <PaymentsTabs
      elder={relation ? { id: relation.elderUserId, name: relation.elderUser.name } : null}
      self={{ id: user.id, name: user.name }}
    />
  );
}
