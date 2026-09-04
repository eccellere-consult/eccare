import type { Prisma, PrismaClient } from '@prisma/client';

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Creates a placeholder provider account plus its ServiceProvider row, for
 * directory entries an admin/committee adds on someone's behalf — local
 * doctors and auto drivers don't get EC logins (same "no third-party login"
 * pattern as advisory experts and property field agents), so this exists
 * purely as a data anchor for ServiceProvider.verificationStatus and the
 * existing admin approval queue (app/admin/providers).
 *
 * The placeholder User is deliberately created with no phone/email — the
 * doctor/driver's real contact number already lives on their own directory
 * row (LocalDoctor.phone / AutoDriver.phone), used for tel:/wa.me links.
 * Setting it here too would risk a unique-constraint collision if that
 * number happens to already belong to some other registered account (an
 * elder, a caregiver) — this placeholder never needs to be found by phone,
 * so it's simplest to just leave it out. Same passwordHash-less shape as
 * the family-invite placeholder elder account in app/api/v1/family/invite.
 */
export async function createDirectoryProvider(
  tx: Tx,
  opts: { name: string; category: 'doctor' | 'auto_transport'; serviceArea?: string | null; phone?: string | null },
) {
  const user = await tx.user.create({
    data: { name: opts.name, role: 'provider' },
  });

  return tx.serviceProvider.create({
    data: {
      userId: user.id,
      businessName: opts.name,
      category: opts.category,
      serviceArea: opts.serviceArea ?? undefined,
      phone: opts.phone ?? undefined,
    },
  });
}
