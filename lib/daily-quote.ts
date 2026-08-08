import { prisma } from '@/lib/db';

export interface TodaysQuote {
  text: string;
  author: string | null;
}

function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// AI-generated quotes always go through an admin approve/reject step first
// (app/admin/quotes) — a deliberate content-safety gate for something shown to
// elders, not something to bypass automatically. But that pool depletes by one
// every single day it's used, and if nobody logs in to top it up, the elder home
// page would just silently show nothing where the quote card used to be. This
// small, hand-written fallback set (never AI-generated, so no review gate needed)
// exists purely so that never happens — it's the "keeps working even if nobody's
// tending the garden" backstop, not a replacement for the real curated pool.
const FALLBACK_QUOTES: TodaysQuote[] = [
  { text: 'Every day is a fresh chance to smile at someone who needs it.', author: null },
  { text: "Small joys, noticed often, add up to a rich life.", author: null },
  { text: 'A phone call to someone you love is never a small thing.', author: null },
  { text: 'The people who ask about your day are the ones worth telling.', author: null },
  { text: 'Slow mornings and warm tea are their own kind of wealth.', author: null },
  { text: 'You have survived every hard day so far — that counts for something.', author: null },
  { text: 'Being remembered by name is one of life’s quiet gifts.', author: null },
  { text: 'A little sunshine on your face is worth stepping outside for.', author: null },
  { text: 'Old friends and old songs both know the way back to your heart.', author: null },
  { text: 'Today doesn’t need to be big — it just needs to be yours.', author: null },
  { text: 'Gratitude turns an ordinary afternoon into an occasion.', author: null },
  { text: 'The best conversations happen when nobody is in a hurry.', author: null },
  { text: 'Rest is not laziness — it is how you keep going.', author: null },
  { text: 'Someone, somewhere, is glad you are their family.', author: null },
];

function fallbackQuoteForToday(today: Date): TodaysQuote {
  const dayOfYear = Math.floor((today.getTime() - Date.UTC(today.getUTCFullYear(), 0, 0)) / 86_400_000);
  return FALLBACK_QUOTES[dayOfYear % FALLBACK_QUOTES.length];
}

/**
 * Returns the quote assigned to today, assigning the next unused approved quote
 * if none has been picked yet. No cron needed — this is evaluated lazily on read.
 * Falls back to a small built-in rotation (never written to the DB — `usedOn`
 * stays reserved for the real curated pool) when the admin hasn't kept the
 * approved queue topped up.
 */
export async function getTodaysQuote(): Promise<TodaysQuote> {
  const today = todayDateOnly();

  const assigned = await prisma.dailyQuote.findFirst({
    where: { usedOn: today },
    select: { text: true, author: true },
  });
  if (assigned) return assigned;

  const next = await prisma.dailyQuote.findFirst({
    where: { status: 'approved', usedOn: null },
    orderBy: { createdAt: 'asc' },
  });
  if (!next) return fallbackQuoteForToday(today);

  await prisma.dailyQuote.update({
    where: { id: next.id },
    data: { usedOn: today },
  });

  return { text: next.text, author: next.author };
}
