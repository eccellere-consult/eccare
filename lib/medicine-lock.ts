import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

/**
 * One person's medicines and reminders are only ever changed by ONE request at a time.
 *
 * Why: reminders are made on demand (a page opens -> "make today's reminders if missing"). When
 * the phone app and the website page ask at the same moment, both used to see "none yet" and both
 * created them, so every medicine showed twice. A database lock (MariaDB/MySQL GET_LOCK) held for
 * the whole check-then-create makes the second request wait and then see the first one's rows.
 *
 * The lock is per person, not global, so two different elders never wait for each other.
 * If the lock cannot be taken within 8 seconds, `fn` is NOT run (`busy` is returned): another
 * request is already doing the same work, and skipping is safe because that work is idempotent.
 * If the database refuses locks altogether, we run `fn` unlocked rather than break reminders
 * for everyone; the duplicate sweeps (lib/medicine-reminders.ts) still clean up after it.
 */
export async function withPersonMedicineLock<T>(
  personId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  busy: T,
): Promise<T> {
  const lockName = `ec-med-${personId}`.slice(0, 60);
  return prisma.$transaction(
    async (tx) => {
      try {
        const rows = await tx.$queryRaw<{ got: bigint | number | null }[]>`SELECT GET_LOCK(${lockName}, 8) AS got`;
        const got = rows[0]?.got;
        // 1 = we hold it. 0 = another request holds it (and is doing the same work). null = error.
        if (got !== null && got !== undefined && Number(got) === 0) return busy;
      } catch (err) {
        console.warn('[medicine-lock] could not take lock, continuing unlocked:', err instanceof Error ? err.message : err);
      }
      try {
        return await fn(tx);
      } finally {
        await tx.$queryRaw`SELECT RELEASE_LOCK(${lockName})`.catch(() => {});
      }
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}
