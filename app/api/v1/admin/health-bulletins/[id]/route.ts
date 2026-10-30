import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiError, apiOk, requireAdmin } from '@/lib/admin-route';
import { checkPublishable, hasBlock, type Flag } from '@/lib/health-bulletin-rules';

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(7000),
  whatsappText: z.string().trim().min(1).max(3000),
});

/** Edit a draft's wording. The same safety rules run again on the new text, so an edit cannot sneak in
 *  a dose or remove the "not medical advice" line. Findings about the sources are kept as they were. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError('INVALID_INPUT', 'Please keep a title, a notice and a WhatsApp message.');

  const { id } = await params;
  const existing = await prisma.healthBulletin.findUnique({ where: { id } });
  if (!existing) return apiError('NOT_FOUND', 'Bulletin not found.', 404);
  if (existing.status !== 'draft') return apiError('NOT_EDITABLE', 'Only drafts can be edited.');

  const sourceFlags = ((existing.flags as Flag[] | null) ?? []).filter((f) => ['untrusted-source', 'source-not-searched', 'no-sources', 'many-sources'].includes(f.code));
  const flags = [...sourceFlags, ...checkPublishable(parsed.data.title, parsed.data.body, parsed.data.whatsappText)];
  const updated = await prisma.healthBulletin.update({ where: { id }, data: { ...parsed.data, flags } });
  return apiOk({ bulletin: updated, blocked: hasBlock(flags) });
}
