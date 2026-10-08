import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireMembership, invalidInput, ok } from '@/lib/community-route';
import { hashPassword } from '@/lib/auth';
import { registerDirectoryEntries } from '@/lib/directory-register';

const schema = z.object({
  neighborhoodId: z.string().optional(),
  ids: z.array(z.string().min(1)).min(1).max(300),
  role: z.enum(['elder', 'caregiver']),
  password: z.string().min(8, 'Please set a starting password of at least 8 characters.').max(72),
});

/** Registers selected Local Directory entries as members on their behalf, with one
 *  shared starting password — committee/admin only, same gate as the Excel bulk
 *  register. See lib/directory-register.ts. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return invalidInput(parsed.error?.issues?.[0]?.message || 'Please choose who to register and set a password.');
  }

  const guard = await requireMembership(req, { neighborhoodId: parsed.data.neighborhoodId, manage: true });
  if (guard.error) return guard.error;

  const results = await registerDirectoryEntries({
    neighborhoodId: guard.neighborhoodId,
    ids: parsed.data.ids,
    role: parsed.data.role,
    passwordHash: await hashPassword(parsed.data.password),
  });

  return ok({
    created: results.filter((r) => r.status === 'created').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    results,
  });
}
