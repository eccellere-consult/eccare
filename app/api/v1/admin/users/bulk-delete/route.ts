import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({
  ids: z.array(z.string()).min(1).max(100),
  // Deliberately a typed literal, not just a boolean flag — the single-delete
  // route (DELETE /admin/users/[id]) requires typing the exact account name
  // back for the same reason: a User delete cascades to everything
  // (medications, health records, family relations, SOS history, memories,
  // orders, community posts...) and this must stay hard to trigger by
  // accident. Typing each name individually would defeat the point of a bulk
  // action, so this uses the "type DELETE to confirm" pattern instead —
  // still requires the admin to consciously read what they typed, but scales
  // to N accounts in one step.
  confirm: z.literal('DELETE'),
});

/** Platform-admin-only. Never deletes the caller's own account, even if
 *  somehow included in `ids` — a bulk "select all" is far easier to
 *  accidentally include yourself in than the single-delete flow (which
 *  requires navigating to that specific row and typing that person's exact
 *  name), so this is a server-side hard block, not just a UI omission. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.role !== 'admin') {
    return fail('FORBIDDEN', 'Only platform admins can do this.', 403);
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('VALIDATION', 'Please select at least one account and confirm.');

  const ids = parsed.data.ids.filter((id) => id !== auth.userId);
  if (ids.length === 0) {
    return fail('NO_VALID_TARGETS', 'Your own account can\'t be deleted this way, and no other accounts were selected.');
  }

  const result = await prisma.user.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ success: true, data: { deletedCount: result.count } });
}
