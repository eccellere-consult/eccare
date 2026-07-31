import { prisma } from '@/lib/db';

/** True if the caller is the elder themself, or a caregiver with an accepted FamilyRelation to them. */
export async function canAccessElder(callerId: string, elderUserId: string): Promise<boolean> {
  if (callerId === elderUserId) return true;

  const relation = await prisma.familyRelation.findUnique({
    where: { elderUserId_caregiverUserId: { elderUserId, caregiverUserId: callerId } },
  });
  return relation?.inviteStatus === 'accepted';
}
