import { prisma } from '@/lib/db';
import { setUpPeople, type AccountReport } from './accounts';
import { buildHealth } from './health';
import { setUpProviders } from './providers';
import { buildCommunity } from './community';
import { buildServices, DEMO_GERIATRIC_NAMES, DEMO_NEWSLETTER_TITLES } from './services';
import { DEMO_COMMUNITY_CODE, DEMO_EMAIL_DOMAIN, MAIN_ACCOUNTS, Tally } from './helpers';

export interface DemoLoadResult {
  counts: Record<string, number>;
  accounts: AccountReport[];
  community: { name: string; joinCode: string };
}

export interface DemoStatus {
  loaded: boolean;
  community: { name: string; joinCode: string; members: number } | null;
  demoPeople: number;
}

export async function getDemoStatus(): Promise<DemoStatus> {
  const [hood, demoPeople] = await Promise.all([
    prisma.neighborhood.findUnique({
      where: { joinCode: DEMO_COMMUNITY_CODE },
      select: { name: true, joinCode: true, _count: { select: { members: true } } },
    }),
    prisma.user.count({ where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } } }),
  ]);
  return {
    loaded: Boolean(hood),
    community: hood ? { name: hood.name, joinCode: hood.joinCode, members: hood._count.members } : null,
    demoPeople,
  };
}

/** Removes everything the demo created: the community, the supporting people, the platform
 *  directories it added, and the demo records on the three test accounts. The three accounts
 *  themselves (and their passwords) are kept. */
export async function removeDemoData(): Promise<void> {
  const [elder, family, providerUser, demoUsers, hood] = await Promise.all([
    prisma.user.findUnique({ where: { email: MAIN_ACCOUNTS.elder.email }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: MAIN_ACCOUNTS.family.email }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: MAIN_ACCOUNTS.provider.email }, select: { id: true } }),
    prisma.user.findMany({ where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } }, select: { id: true } }),
    prisma.neighborhood.findUnique({ where: { joinCode: DEMO_COMMUNITY_CODE }, select: { id: true } }),
  ]);
  const demoIds = demoUsers.map((u) => u.id);
  const pharmacy = providerUser ? await prisma.serviceProvider.findUnique({ where: { userId: providerUser.id }, select: { id: true } }) : null;

  // Records that hang off the elder (their care, orders, bookings, contacts, photos…).
  if (elder) {
    const e = elder.id;
    await prisma.order.deleteMany({ where: { elderUserId: e } });
    await prisma.recurringOrderTemplate.deleteMany({ where: { elderUserId: e } });
    await prisma.doctorBooking.deleteMany({ where: { elderUserId: e } });
    await prisma.autoBooking.deleteMany({ where: { elderUserId: e } });
    await prisma.consultationRequest.deleteMany({ where: { elderUserId: e } });
    await prisma.propertySubscription.deleteMany({ where: { elderUserId: e } });
    await prisma.linkedBiller.deleteMany({ where: { elderUserId: e } });
    await prisma.medication.deleteMany({ where: { userId: e } });
    await prisma.prescription.deleteMany({ where: { userId: e } });
    await prisma.appointment.deleteMany({ where: { userId: e } });
    await prisma.healthNote.deleteMany({ where: { userId: e } });
    await prisma.healthCoverageItem.deleteMany({ where: { userId: e } });
    await prisma.familyMediaLink.deleteMany({ where: { userId: e } });
    await prisma.moodLog.deleteMany({ where: { userId: e } });
    await prisma.reminder.deleteMany({ where: { userId: e } });
    await prisma.foodRequest.deleteMany({ where: { userId: e } });
    await prisma.voiceLog.deleteMany({ where: { userId: e } });
    await prisma.sOSEvent.deleteMany({ where: { userId: e } });
    await prisma.emergencyContact.deleteMany({ where: { userId: e } });
    await prisma.contact.deleteMany({ where: { elderUserId: e } });
    await prisma.memory.deleteMany({ where: { elderUserId: e } });
    await prisma.familyRelation.deleteMany({ where: { elderUserId: e } });
  }
  const accountIds = [elder?.id, family?.id].filter((x): x is string => Boolean(x));
  if (accountIds.length) {
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: accountIds } } });
    await prisma.neighborFavorite.deleteMany({ where: { userId: { in: accountIds } } });
    await prisma.providerRating.deleteMany({ where: { raterUserId: { in: accountIds } } });
  }
  // The pharmacy test login keeps its profile; its catalog, orders and listings go.
  if (pharmacy) {
    await prisma.order.deleteMany({ where: { providerId: pharmacy.id } });
    await prisma.catalogItem.deleteMany({ where: { providerId: pharmacy.id } });
    await prisma.communityProviderListing.deleteMany({ where: { providerId: pharmacy.id } });
    await prisma.providerRating.deleteMany({ where: { providerId: pharmacy.id } });
  }
  if (providerUser) await prisma.localListing.deleteMany({ where: { addedById: providerUser.id, neighborhood: hood ? { id: hood.id } : undefined } });

  // The community (members, notices, events, fees, vendors, doctors, drivers… all cascade).
  if (hood) await prisma.neighborhood.delete({ where: { id: hood.id } });
  await prisma.communityApplication.deleteMany({ where: { applicantEmail: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } } });

  // Platform-wide content the demo added.
  await prisma.newsletter.deleteMany({ where: { title: { in: DEMO_NEWSLETTER_TITLES } } });
  await prisma.geriatricCareListing.deleteMany({ where: { name: { in: DEMO_GERIATRIC_NAMES } } });

  // Supporting people last; everything they own cascades with them.
  if (demoIds.length) {
    await prisma.rentalListing.deleteMany({ where: { postedById: { in: demoIds } } });
    await prisma.user.deleteMany({ where: { id: { in: demoIds } } });
  }
}

/** Loads (or refreshes) the full demo. Safe to run more than once: it clears the previous
 *  demo first, so the dates are always current and nothing is duplicated. */
export async function loadDemoData(adminId: string): Promise<DemoLoadResult> {
  await removeDemoData();
  const tally = new Tally();

  const people = await setUpPeople(adminId, tally);
  const health = await buildHealth(people, tally);
  const providers = await setUpProviders(people, tally);
  const community = await buildCommunity(people, providers, tally);
  await buildServices(people, providers, community, tally, health.medications);

  // A family account that has a lapsed subscription would be locked out of the demo.
  // (An account with no subscription row is never blocked, so none is created.)
  await prisma.familySubscription.updateMany({
    where: { caregiverUserId: people.familyId },
    data: { status: 'active', billingCycle: 'annual', currentPeriodEnd: new Date(Date.now() + 300 * 86_400_000) },
  });

  return {
    counts: tally.counts,
    accounts: people.accounts,
    community: { name: 'Sunrise Residency', joinCode: DEMO_COMMUNITY_CODE },
  };
}
