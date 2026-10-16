import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { normalizeHouseInput } from '@/lib/house';
import { isValidLatLng } from '@/lib/geo';
import { communityHousePrefix, pinHouseIfMissing } from '@/lib/house-location';
import { reconcileMemberWithDirectory } from '@/lib/directory-link';

/** What a person sends to join a community while creating their account. Same meaning as on the
 *  join page (POST /community/join): choose it from the list, or type its code; a house; optionally
 *  where the house is. */
export interface RegistrationCommunity {
  neighborhoodId?: string;
  joinCode?: string;
  flatNumber?: string;
  lat?: number;
  lng?: number;
}

export type JoinPlan =
  | {
      ok: true;
      neighborhoodId: string;
      neighborhoodName: string;
      flatNumber: string;
      location: { lat: number; lng: number } | null;
      /** pending when the community has someone to approve it, approved when it is brand new. */
      status: 'pending' | 'approved';
    }
  | { ok: false; code: string; message: string; httpStatus: number };

const fail = (code: string, message: string, httpStatus = 400): JoinPlan => ({ ok: false, code, message, httpStatus });

/** Checks everything about joining a community BEFORE any account exists, so a registration is
 *  accepted whole or not at all: the community is real, the house is valid (a bare number is completed
 *  with the community's house prefix), and the same rules as the join page apply — a community with
 *  nobody to approve is joined with its code only. */
export async function planCommunityJoin(input: RegistrationCommunity): Promise<JoinPlan> {
  if (!input.neighborhoodId && !input.joinCode) return fail('COMMUNITY_REQUIRED', 'Please choose your community to finish creating your account.');

  const neighborhood = input.neighborhoodId
    ? await prisma.neighborhood.findUnique({ where: { id: input.neighborhoodId }, select: { id: true, name: true, housePrefix: true, members: { where: { status: 'approved' }, select: { flatNumber: true } } } })
    : await prisma.neighborhood.findUnique({ where: { joinCode: (input.joinCode ?? '').trim().toUpperCase() }, select: { id: true, name: true, housePrefix: true, members: { where: { status: 'approved' }, select: { flatNumber: true } } } });
  if (!neighborhood) {
    return fail('NOT_FOUND', input.joinCode ? 'No community found with that code.' : 'That community could not be found.', 404);
  }

  // A bare number ("27") is completed with the block most houses in this community share ("KGRA-27").
  const house = normalizeHouseInput(input.flatNumber, { defaultBlock: communityHousePrefix(neighborhood.housePrefix, neighborhood.members.map((m) => m.flatNumber)) ?? undefined });
  if (!house.ok) return fail('INVALID_INPUT', house.message);

  const hasApprover = await prisma.neighborhoodMember.findFirst({
    where: { neighborhoodId: neighborhood.id, status: 'approved', role: { in: ['committee', 'admin'] } },
    select: { id: true },
  });
  if (!input.joinCode && !hasApprover) {
    return fail('CODE_REQUIRED', 'This community is not open for joining from the list yet. Please ask your committee for the community code.', 403);
  }

  const location = input.lat !== undefined && input.lng !== undefined && isValidLatLng(input.lat, input.lng) ? { lat: input.lat, lng: input.lng } : null;
  return {
    ok: true,
    neighborhoodId: neighborhood.id,
    neighborhoodName: neighborhood.name,
    flatNumber: house.value,
    location,
    status: hasApprover ? 'pending' : 'approved',
  };
}

/** Writes the membership for a planned join, inside the same transaction as the account. A person who
 *  is already an approved member of that community (an account made earlier from the directory) is left as is. */
export async function saveMembership(tx: Prisma.TransactionClient, plan: Extract<JoinPlan, { ok: true }>, userId: string): Promise<void> {
  const where = { neighborhoodId_userId: { neighborhoodId: plan.neighborhoodId, userId } };
  const current = await tx.neighborhoodMember.findUnique({ where });
  if (current?.status === 'approved') return;
  const data = {
    flatNumber: plan.flatNumber,
    status: plan.status,
    approvedAt: null,
    approvedById: null,
    rejectionReason: null,
    // The location waits with a pending request until the committee approves it; an approved member's is pinned right away.
    joinLat: plan.status === 'pending' && plan.location ? plan.location.lat : null,
    joinLng: plan.status === 'pending' && plan.location ? plan.location.lng : null,
  };
  await tx.neighborhoodMember.upsert({ where, create: { neighborhoodId: plan.neighborhoodId, userId, ...data }, update: data });
}

/** After the account is saved: pin the house (a brand-new community's first member) and link the
 *  person to any directory entry the community already holds for them. Never fails the registration. */
export async function finishJoin(plan: Extract<JoinPlan, { ok: true }>, userId: string): Promise<void> {
  if (plan.status === 'approved' && plan.location) {
    await pinHouseIfMissing({ neighborhoodId: plan.neighborhoodId, house: plan.flatNumber, userId, ...plan.location }).catch(() => false);
  }
  try {
    await reconcileMemberWithDirectory(plan.neighborhoodId, userId);
  } catch (err) {
    console.error('[directory-link] reconcile failed:', err instanceof Error ? err.message : err);
  }
}
