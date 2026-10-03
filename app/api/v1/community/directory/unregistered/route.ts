import { NextRequest } from 'next/server';
import { requireMembership, ok, compareByFlatNumberAsc } from '@/lib/community-route';
import { getVisiblePlaceholders } from '@/lib/directory-link';

/** Directory entries from the bulk directory import who haven't registered yet,
 *  with their invite status — committee/admin only, since it's the working list
 *  for sending WhatsApp invites (the Local Directory itself deliberately doesn't
 *  expose invitedAt to ordinary residents).
 *
 *  Anyone who has since registered and joined is left out — matched by phone
 *  number, or linked to their account (see lib/directory-link.ts): they did what
 *  the invite asked, so they're no longer "pending". */
export async function GET(req: NextRequest) {
  const guard = await requireMembership(req, { manage: true });
  if (guard.error) return guard.error;

  const pending = (await getVisiblePlaceholders(guard.neighborhoodId)).sort(compareByFlatNumberAsc);

  return ok(
    pending.map((e) => ({
      id: e.id,
      name: e.name,
      phone: e.phone,
      flatNumber: e.flatNumber,
      invitedAt: e.invitedAt,
    })),
  );
}
