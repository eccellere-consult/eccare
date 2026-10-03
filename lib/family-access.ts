import { prisma } from '@/lib/db';
import { isCaregiverEligible } from '@/lib/age';

/** True if the caller is the elder themself, or a caregiver with an accepted
 *  FamilyRelation to them — and the age rule allows them to act as a caregiver
 *  (under 60, or an admin exception; see isCaregiverEligible). The age check is
 *  on the person, not their role label, so it still holds if a 60+ caregiver
 *  switched to an elder account while keeping old family links. */
export async function canAccessElder(callerId: string, elderUserId: string): Promise<boolean> {
  if (callerId === elderUserId) return true;

  const relation = await prisma.familyRelation.findUnique({
    where: { elderUserId_caregiverUserId: { elderUserId, caregiverUserId: callerId } },
    include: { caregiverUser: { select: { dateOfBirth: true, caregiverException: true } } },
  });
  if (relation?.inviteStatus !== 'accepted') return false;
  return isCaregiverEligible(relation.caregiverUser);
}
