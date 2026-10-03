import { prisma } from '@/lib/db';
import { houseKey } from '@/lib/house';

/**
 * Connecting a person who registers and joins a community to the entry the
 * community's admin already put in the Local Directory for them.
 *
 * - Same phone number  -> certain. Linked automatically, nobody looks at it.
 * - Anything else that plausibly matches (same house number + similar name, or a
 *   near-identical name with a house number missing on one side) -> uncertain.
 *   Becomes a DirectoryMatchSuggestion for the COMMITTEE to confirm or reject;
 *   nothing is linked until they do.
 * - Everything else (same house but a different name — a spouse, a child — or no
 *   resemblance at all) is left alone: two people in one flat are normal.
 */

// ─── Matching helpers (pure) ─────────────────────────────────────────────────

export const normalizeHouse = houseKey;

const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'shri', 'smt', 'sri', 'late']);

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t && !TITLES.has(t));
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) return true;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1); // one substitution
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  return long.slice(i + 1) === short.slice(i); // one insertion/deletion
}

function tokenScore(a: string, b: string): number {
  if (a === b) return 1;
  // An initial standing in for a name ("Ramesh K" vs "Ramesh Kumar").
  if ((a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b))) return 0.6;
  // A typo or spelling variant ("Suresh"/"Sureshh", "Lakshmi"/"Laxmi" is too far).
  if (a.length >= 4 && b.length >= 4 && editDistanceAtMostOne(a, b)) return 0.85;
  return 0;
}

/** 0..1 — how alike two people's names are, ignoring order and titles. Each token
 *  of the shorter name is matched to its best partner in the other. */
export function nameSimilarity(a: string, b: string): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const [small, large] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const used = new Set<number>();
  let total = 0;
  for (const token of small) {
    let best = 0;
    let bestIdx = -1;
    large.forEach((other, idx) => {
      if (used.has(idx)) return;
      const s = tokenScore(token, other);
      if (s > best) {
        best = s;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0) used.add(bestIdx);
    total += best;
  }
  // Penalise a big difference in how many name parts there are a little, so a
  // lone first name doesn't score as high as a full match.
  const lengthPenalty = small.length / large.length;
  return (total / small.length) * (0.7 + 0.3 * lengthPenalty);
}

export type MatchReason = 'house_and_name' | 'name_only';

export function scoreMatch(
  placeholder: { name: string; flatNumber: string | null },
  member: { name: string; flatNumber: string | null },
): { reason: MatchReason; score: number } | null {
  const hp = normalizeHouse(placeholder.flatNumber);
  const hm = normalizeHouse(member.flatNumber);
  const ns = nameSimilarity(placeholder.name, member.name);

  if (hp && hm) {
    // Both houses known: they must agree, and the names must resemble each other
    // (same house + different name is a different person).
    if (hp === hm && ns >= 0.6) return { reason: 'house_and_name', score: 0.5 + 0.5 * ns };
    return null;
  }
  // A house number is missing on one side, so the name has to carry it alone.
  if (ns >= 0.9) return { reason: 'name_only', score: ns * 0.8 };
  return null;
}

const MAX_SUGGESTIONS = 3;

// ─── Linking ─────────────────────────────────────────────────────────────────

/** Claims a directory entry for a member's account, atomically: only succeeds if
 *  nobody has claimed it yet. Carries the entry's house number over when the
 *  member has none of their own (what they typed themselves always wins), and
 *  retires any other open suggestions that involved this entry or this person. */
export async function linkPlaceholderToMember(
  placeholderId: string,
  neighborhoodId: string,
  userId: string,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.unregisteredResident.updateMany({
      where: { id: placeholderId, neighborhoodId, claimedByUserId: null },
      data: { claimedByUserId: userId, claimedAt: new Date() },
    });
    if (claimed.count !== 1) return false;

    const placeholder = await tx.unregisteredResident.findUnique({
      where: { id: placeholderId },
      select: { flatNumber: true },
    });
    if (placeholder?.flatNumber) {
      await tx.neighborhoodMember.updateMany({
        where: { neighborhoodId, userId, flatNumber: null },
        data: { flatNumber: placeholder.flatNumber },
      });
    }
    await tx.directoryMatchSuggestion.updateMany({
      where: { neighborhoodId, status: 'pending', OR: [{ placeholderId }, { userId }] },
      data: { status: 'superseded' },
    });
    return true;
  });
}

/** Runs when someone joins a community (or is bulk-registered into one). */
export async function reconcileMemberWithDirectory(
  neighborhoodId: string,
  userId: string,
): Promise<{ linked: boolean; suggested: number }> {
  const [member, alreadyLinked] = await Promise.all([
    prisma.neighborhoodMember.findUnique({
      where: { neighborhoodId_userId: { neighborhoodId, userId } },
      include: { user: { select: { name: true, phone: true } } },
    }),
    prisma.unregisteredResident.findFirst({ where: { neighborhoodId, claimedByUserId: userId }, select: { id: true } }),
  ]);
  if (!member || alreadyLinked) return { linked: false, suggested: 0 };

  const candidates = await prisma.unregisteredResident.findMany({
    where: { neighborhoodId, claimedByUserId: null },
    select: { id: true, name: true, phone: true, flatNumber: true },
  });

  // Certain: the same phone number.
  if (member.user.phone) {
    const exact = candidates.find((c) => c.phone === member.user.phone);
    if (exact) {
      const linked = await linkPlaceholderToMember(exact.id, neighborhoodId, userId);
      if (linked) return { linked: true, suggested: 0 };
    }
  }

  // Uncertain: a plausible resemblance. Already-decided pairs are never re-raised.
  const decided = await prisma.directoryMatchSuggestion.findMany({
    where: { neighborhoodId, userId },
    select: { placeholderId: true },
  });
  const skip = new Set(decided.map((d) => d.placeholderId));

  const scored = candidates
    .filter((c) => !skip.has(c.id))
    .map((c) => ({ c, match: scoreMatch(c, { name: member.user.name, flatNumber: member.flatNumber }) }))
    .filter((x): x is { c: (typeof candidates)[number]; match: NonNullable<ReturnType<typeof scoreMatch>> } => !!x.match)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, MAX_SUGGESTIONS);

  for (const { c, match } of scored) {
    await prisma.directoryMatchSuggestion.create({
      data: { neighborhoodId, placeholderId: c.id, userId, reason: match.reason, score: match.score },
    });
  }
  return { linked: false, suggested: scored.length };
}

/** Runs after an admin bulk-adds directory entries: some of those people may have
 *  joined already under a different number, so compare the new entries to the
 *  existing members. (Same-phone people are filtered out earlier, at upload.) */
export async function suggestForNewPlaceholders(neighborhoodId: string, placeholderIds: string[]): Promise<number> {
  if (placeholderIds.length === 0) return 0;

  const [placeholders, members, linkedUsers] = await Promise.all([
    prisma.unregisteredResident.findMany({
      where: { id: { in: placeholderIds }, neighborhoodId, claimedByUserId: null },
      select: { id: true, name: true, flatNumber: true },
    }),
    prisma.neighborhoodMember.findMany({
      where: { neighborhoodId, status: { not: 'rejected' } },
      select: { userId: true, flatNumber: true, user: { select: { name: true } } },
    }),
    prisma.unregisteredResident.findMany({
      where: { neighborhoodId, claimedByUserId: { not: null } },
      select: { claimedByUserId: true },
    }),
  ]);
  const alreadyLinked = new Set(linkedUsers.map((l) => l.claimedByUserId));
  const eligibleMembers = members.filter((m) => !alreadyLinked.has(m.userId));

  let created = 0;
  for (const p of placeholders) {
    const scored = eligibleMembers
      .map((m) => ({ m, match: scoreMatch(p, { name: m.user.name, flatNumber: m.flatNumber }) }))
      .filter((x): x is { m: (typeof eligibleMembers)[number]; match: NonNullable<ReturnType<typeof scoreMatch>> } => !!x.match)
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, MAX_SUGGESTIONS);
    for (const { m, match } of scored) {
      await prisma.directoryMatchSuggestion.create({
        data: { neighborhoodId, placeholderId: p.id, userId: m.userId, reason: match.reason, score: match.score },
      });
      created++;
    }
  }
  return created;
}

// ─── Visibility ──────────────────────────────────────────────────────────────

/** The unregistered entries that should still show in the directory / invite list.
 *  An entry is resolved — hidden — when the person it describes is a member:
 *  matched by the same phone number (even if never formally linked), or claimed
 *  by a linked account that is still a member. A rejected or removed member
 *  doesn't count, so their entry reappears rather than vanishing. */
export async function getVisiblePlaceholders(neighborhoodId: string) {
  const [entries, members] = await Promise.all([
    prisma.unregisteredResident.findMany({ where: { neighborhoodId }, orderBy: { createdAt: 'asc' } }),
    prisma.neighborhoodMember.findMany({
      where: { neighborhoodId, status: { not: 'rejected' } },
      select: { userId: true, user: { select: { phone: true } } },
    }),
  ]);
  const memberIds = new Set(members.map((m) => m.userId));
  const memberPhones = new Set(members.map((m) => m.user.phone).filter(Boolean));
  return entries.filter((e) => {
    if (e.claimedByUserId && memberIds.has(e.claimedByUserId)) return false;
    if (e.phone && memberPhones.has(e.phone)) return false;
    return true;
  });
}
