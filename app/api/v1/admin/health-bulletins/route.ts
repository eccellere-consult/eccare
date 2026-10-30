import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiError, apiOk, requireAdmin } from '@/lib/admin-route';
import { HEALTH_TOPICS } from '@/lib/health-sources';
import { healthAgentModel, runHealthAgent } from '@/lib/health-agent';

// Writing a bulletin means a web search and a long answer — allow it time.
export const maxDuration = 180;

const STATUSES = ['draft', 'published', 'rejected'] as const;

/** Bulletins (newest first), plus what the screen needs to publish them: topics, communities and their
 *  WhatsApp groups, and whether the agent is set up. */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const status = req.nextUrl.searchParams.get('status');
  const [bulletins, communities] = await Promise.all([
    prisma.healthBulletin.findMany({
      where: status && (STATUSES as readonly string[]).includes(status) ? { status: status as (typeof STATUSES)[number] } : undefined,
      orderBy: { generatedAt: 'desc' },
      take: 100,
    }),
    prisma.neighborhood.findMany({
      select: { id: true, name: true, city: true, whatsAppGroups: { select: { id: true, name: true, inviteUrl: true } } },
      orderBy: { name: 'asc' },
    }),
  ]);

  return apiOk({
    bulletins,
    communities,
    topics: HEALTH_TOPICS.map((t) => ({ id: t.id, label: t.label })),
    agent: { configured: !!process.env.ANTHROPIC_API_KEY, model: healthAgentModel(), scheduled: !!process.env.CRON_SECRET },
  });
}

const generateSchema = z.object({ topic: z.string().optional() });

/** Writes one new draft now. With no topic, the one that has gone longest without a bulletin. */
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const parsed = generateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return apiError('INVALID_INPUT', 'Please choose a topic from the list.');
  if (parsed.data.topic && !HEALTH_TOPICS.some((t) => t.id === parsed.data.topic)) return apiError('INVALID_INPUT', 'Unknown topic.');
  if (!process.env.ANTHROPIC_API_KEY) return apiError('NOT_CONFIGURED', 'The health agent needs ANTHROPIC_API_KEY to be set on the server.', 503);

  const [result] = await runHealthAgent({ topicIds: parsed.data.topic ? [parsed.data.topic] : undefined, count: 1, force: true });
  if (result.outcome === 'error') return apiError('AGENT_FAILED', result.reason, 502);
  if (result.outcome === 'unusable') return apiError('AGENT_FAILED', `The agent's answer could not be used (${result.reason}). Please try again.`, 502);
  return apiOk(result);
}
