import { prisma } from '@/lib/db';

export interface TodaysQuote {
  text: string;
  author: string | null;
}

function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Returns the quote assigned to today, assigning the next unused approved quote
 * if none has been picked yet. No cron needed — this is evaluated lazily on read.
 */
export async function getTodaysQuote(): Promise<TodaysQuote | null> {
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
  if (!next) return null;

  await prisma.dailyQuote.update({
    where: { id: next.id },
    data: { usedOn: today },
  });

  return { text: next.text, author: next.author };
}
