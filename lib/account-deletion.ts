import { prisma } from '@/lib/db';
import { deleteFromStorage } from '@/lib/storage';

/** Email domain given to a deleted account. `.invalid` can never be a real address (RFC 2606), so a
 *  deleted account is recognisable from its email alone, and its old sign-in tokens can be refused
 *  without adding a column to the database. */
export const DELETED_EMAIL_SUFFIX = '@deleted.invalid';

export function isDeletedEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(DELETED_EMAIL_SUFFIX);
}

/** Roles that can remove their own account from the app and website. Admin and provider accounts are
 *  managed with the EC team (they carry shared records), so they are asked to write in instead. */
export const SELF_DELETABLE_ROLES = ['elder', 'caregiver'] as const;

export type DeletionBlock = { code: 'ROLE_NOT_ALLOWED' | 'SOLE_ADMIN'; message: string };

/** Why this person cannot delete the account right now, or null if they can. */
export async function deletionBlockFor(userId: string, role: string): Promise<DeletionBlock | null> {
  if (!(SELF_DELETABLE_ROLES as readonly string[]).includes(role)) {
    return {
      code: 'ROLE_NOT_ALLOWED',
      message: 'This kind of account is removed by the EC team. Please write to contact@eccare.in from your registered email and we will do it.',
    };
  }

  // Someone who is the only administrator of a community would leave it with nobody in charge.
  const adminOf = await prisma.neighborhoodMember.findMany({
    where: { userId, role: 'admin' },
    select: { neighborhoodId: true, neighborhood: { select: { name: true } } },
  });
  for (const m of adminOf) {
    const others = await prisma.neighborhoodMember.count({
      where: { neighborhoodId: m.neighborhoodId, role: 'admin', userId: { not: userId } },
    });
    if (others === 0) {
      return {
        code: 'SOLE_ADMIN',
        message: `You are the only administrator of ${m.neighborhood.name}. Please make another member an administrator first, or write to contact@eccare.in and we will help.`,
      };
    }
  }
  return null;
}

/**
 * Removes a person's account and the personal data tied to it.
 *
 * What goes: everything that is about this person (health records, medicines, prescriptions, SOS history,
 * contacts, memories, voice history, devices, community membership and the posts and messages they wrote
 * for others), every family link, and their name, phone, email, address, date of birth, photo, password
 * and PIN.
 *
 * What stays, without their name: records other people or the law rely on - orders and payments, fee
 * charges, subscription records, and community notices, events and documents a committee published. The
 * account row itself is kept as an empty "Deleted user" shell so those records keep working; it can never
 * be signed into again.
 *
 * Everything in the database is changed in one transaction: if any step fails, nothing is changed.
 * Uploaded files are removed from storage afterwards, on a best-effort basis.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const id = userId;

  // Remember the uploaded files before their rows are gone.
  const [user, prescriptions, memories, coverage, listings, rentals] = await Promise.all([
    prisma.user.findUnique({ where: { id }, select: { avatarUrl: true } }),
    prisma.prescription.findMany({ where: { userId: id }, select: { filePath: true } }),
    prisma.memory.findMany({ where: { elderUserId: id }, select: { imagePath: true } }),
    prisma.healthCoverageItem.findMany({ where: { userId: id }, select: { filePath: true } }),
    prisma.marketplaceListing.findMany({ where: { postedById: id }, select: { imagePath: true } }),
    prisma.rentalListing.findMany({ where: { postedById: id }, select: { imagePath: true } }),
  ]);
  const files = [
    user?.avatarUrl,
    ...prescriptions.map((p) => p.filePath),
    ...memories.map((m) => m.imagePath),
    ...coverage.map((c) => c.filePath),
    ...listings.map((l) => l.imagePath),
    ...rentals.map((r) => r.imagePath),
  ].filter((f): f is string => !!f);

  await prisma.$transaction([
    // Sign-in and devices
    prisma.deviceToken.deleteMany({ where: { userId: id } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: id } }),
    prisma.notificationPreference.deleteMany({ where: { userId: id } }),

    // Family links, both directions
    prisma.familyRelation.deleteMany({ where: { OR: [{ elderUserId: id }, { caregiverUserId: id }] } }),

    // Health and care records about this person
    prisma.medicationReminder.deleteMany({ where: { userId: id } }),
    prisma.medication.deleteMany({ where: { userId: id } }),
    prisma.appointment.deleteMany({ where: { userId: id } }),
    prisma.healthNote.deleteMany({ where: { userId: id } }),
    prisma.healthCoverageItem.deleteMany({ where: { userId: id } }),
    prisma.familyMediaLink.deleteMany({ where: { userId: id } }),
    prisma.moodLog.deleteMany({ where: { userId: id } }),
    prisma.prescription.deleteMany({ where: { userId: id } }),
    prisma.mealReminder.deleteMany({ where: { userId: id } }),
    prisma.foodRequest.deleteMany({ where: { userId: id } }),
    prisma.reminder.deleteMany({ where: { userId: id } }),
    prisma.voiceLog.deleteMany({ where: { userId: id } }),
    prisma.sOSEvent.deleteMany({ where: { userId: id } }),

    // Contacts, memories and their own service requests
    prisma.emergencyContact.deleteMany({ where: { userId: id } }),
    prisma.emergencyContact.updateMany({ where: { linkedUserId: id }, data: { linkedUserId: null } }),
    prisma.contact.deleteMany({ where: { elderUserId: id } }),
    prisma.memory.deleteMany({ where: { elderUserId: id } }),
    prisma.linkedBiller.deleteMany({ where: { elderUserId: id } }),
    prisma.consultationRequest.deleteMany({ where: { elderUserId: id } }),
    prisma.autoBooking.deleteMany({ where: { elderUserId: id } }),
    prisma.doctorBooking.deleteMany({ where: { elderUserId: id } }),
    prisma.recurringOrderTemplate.deleteMany({ where: { elderUserId: id } }),
    prisma.volunteerProfile.deleteMany({ where: { userId: id } }),
    prisma.providerRating.deleteMany({ where: { raterUserId: id } }),

    // Community: membership, and what they wrote for others
    prisma.neighborhoodMember.deleteMany({ where: { userId: id } }),
    prisma.neighborFavorite.deleteMany({ where: { userId: id } }),
    prisma.communityEventRsvp.deleteMany({ where: { userId: id } }),
    prisma.hobbyGroupMember.deleteMany({ where: { userId: id } }),
    prisma.greeting.deleteMany({ where: { OR: [{ fromUserId: id }, { toUserId: id }] } }),
    prisma.chatMessage.deleteMany({ where: { senderId: id } }),
    prisma.committeeQueryReply.deleteMany({ where: { userId: id } }),
    prisma.committeeQuery.deleteMany({ where: { userId: id } }),
    prisma.marketplaceListing.deleteMany({ where: { postedById: id } }),
    prisma.rentalInquiry.deleteMany({ where: { inquirerId: id } }),
    prisma.rentalListing.deleteMany({ where: { postedById: id } }),
    prisma.communityJobPosting.deleteMany({ where: { postedById: id } }),

    // The account itself: keep an empty shell, drop every personal detail and the ability to sign in
    prisma.user.update({
      where: { id },
      data: {
        name: 'Deleted user',
        email: `deleted-${id}${DELETED_EMAIL_SUFFIX}`,
        phone: null,
        passwordHash: null,
        pinHash: null,
        avatarUrl: null,
        secondaryLanguage: null,
        bloodGroup: null,
        dateOfBirth: null,
        address: null,
        city: null,
        state: null,
        pincode: null,
        lat: null,
        lng: null,
        familyDoctorName: null,
        familyDoctorPhone: null,
        familyDoctorVideoLink: null,
        preferredHospitalName: null,
        preferredHospitalLocation: null,
      },
    }),
  ]);

  // Uploaded files, after the database is settled. A failure here must not undo the deletion.
  await Promise.all(files.map((f) => deleteFromStorage(f).catch(() => {})));
}
