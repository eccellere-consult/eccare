import { prisma } from '@/lib/db';

const SUGGESTION_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // ~1 month

/**
 * Idempotently ensures a fresh RecurringOrderSuggestion exists for each of an
 * elder's active RecurringOrderTemplates once ~30 days have passed since the
 * last one — same "auto-heal on read" idiom as
 * lib/medicine-reminders.ts's ensureRemindersForMedication (this app has no
 * cron/background-job mechanism anywhere, so generation happens lazily at
 * read time instead, from GET /api/v1/orders/recurring-suggestions).
 *
 * Never auto-creates an actual Order — a suggestion always starts
 * `pendingApproval` and is only ever turned into a real, charged Order by an
 * explicit elder/caregiver approval (see .../recurring-suggestions/[id]/approve).
 */
export async function ensureRecurringOrderSuggestions(elderUserId: string): Promise<void> {
  const templates = await prisma.recurringOrderTemplate.findMany({
    where: { elderUserId, isActive: true },
    include: { suggestions: { orderBy: { suggestedAt: 'desc' }, take: 1 } },
  });

  const now = Date.now();
  for (const template of templates) {
    const latest = template.suggestions[0];
    // A still-pending suggestion is never superseded by a new one — the
    // elder/caregiver needs to decide on it first, not get buried under a
    // second one a month later.
    if (latest?.status === 'pendingApproval') continue;
    const lastAt = latest?.suggestedAt.getTime() ?? template.createdAt.getTime();
    if (now - lastAt < SUGGESTION_INTERVAL_MS) continue;

    await prisma.recurringOrderSuggestion.create({ data: { templateId: template.id } });
  }
}
