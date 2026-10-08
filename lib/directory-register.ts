import { prisma } from '@/lib/db';
import { isValidAnyPhone, isInternationalPhone, normalizeAnyPhone } from '@/lib/validation';
import { normalizeHouseInput } from '@/lib/house';
import { linkPlaceholderToMember } from '@/lib/directory-link';

export interface RegisterOutcome {
  id: string;
  name: string;
  status: 'created' | 'skipped';
  /** Why a person was skipped — shown to the committee. */
  reason?: string;
}

/** Registers people who are already in the Local Directory as real members, on their
 *  behalf, with one shared starting password (the same idea as the Excel bulk
 *  register in lib/resident-import.ts, but starting from existing directory entries).
 *
 *  For each entry: creates the account + community membership, then claims the
 *  directory entry for that account (lib/directory-link.ts) so the person is listed
 *  once, not twice. An entry is skipped — never failing the rest of the batch — when
 *  it has no usable phone number, the number already belongs to an account, or it was
 *  claimed or removed in the meantime.
 *
 *  A directory entry has no date of birth, so the committee picks the account type for
 *  the batch; each person is asked for their date of birth at first sign-in. */
export async function registerDirectoryEntries(opts: {
  neighborhoodId: string;
  ids: string[];
  role: 'elder' | 'caregiver';
  passwordHash: string;
}): Promise<RegisterOutcome[]> {
  const { neighborhoodId, role, passwordHash } = opts;
  const ids = [...new Set(opts.ids)];

  const [entries, neighborhood] = await Promise.all([
    prisma.unregisteredResident.findMany({ where: { id: { in: ids }, neighborhoodId } }),
    prisma.neighborhood.findUnique({ where: { id: neighborhoodId }, select: { city: true, pincode: true } }),
  ]);
  const byId = new Map(entries.map((e) => [e.id, e]));

  const outcomes: RegisterOutcome[] = [];
  for (const id of ids) {
    const entry = byId.get(id);
    if (!entry) {
      outcomes.push({ id, name: 'Unknown entry', status: 'skipped', reason: 'No longer in this directory.' });
      continue;
    }
    const skip = (reason: string) => outcomes.push({ id, name: entry.name, status: 'skipped', reason });

    if (entry.claimedByUserId) {
      skip('Already registered.');
      continue;
    }
    if (!entry.phone?.trim()) {
      skip('No phone number — add one first (they sign in with it).');
      continue;
    }
    if (!isValidAnyPhone(entry.phone)) {
      skip('The phone number is not valid — edit it first.');
      continue;
    }
    const phone = normalizeAnyPhone(entry.phone);
    if (isInternationalPhone(phone) && role !== 'caregiver') {
      skip('A number outside India can only be used for a family member account.');
      continue;
    }
    const existing = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (existing) {
      skip('This number already has an account — ask them to join with the community code.');
      continue;
    }

    const house = normalizeHouseInput(entry.flatNumber);
    const flatNumber = house.ok ? house.value : (entry.flatNumber ?? undefined);

    try {
      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: entry.name,
            phone,
            role,
            passwordHash,
            address: flatNumber,
            city: neighborhood?.city ?? undefined,
            pincode: neighborhood?.pincode ?? undefined,
          },
          select: { id: true },
        });
        await tx.neighborhoodMember.create({ data: { neighborhoodId, userId: created.id, flatNumber } });
        return created;
      });
      // Claim the entry for this account. If someone claimed it in the same instant the
      // account still stands; the entry just stays under its other owner.
      await linkPlaceholderToMember(id, neighborhoodId, user.id).catch(() => false);
      outcomes.push({ id, name: entry.name, status: 'created' });
    } catch {
      // Phone claimed by a concurrent request between the check and the create.
      skip('Could not create the account — the number may have just been registered.');
    }
  }
  return outcomes;
}
