import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser, createToken, setSessionCookie, toSafeUser, INELIGIBLE_CAREGIVER_ROLE } from '@/lib/auth';

/** For a family-member account whose date of birth puts them at 60 or over (and
 *  who has no admin exception): converts it to an elder account, which is what
 *  their age says they are. Only that exact situation qualifies — anyone else is
 *  refused, so this can't be used to hop between account types at will. Reissues
 *  the session so the new role applies immediately. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }, { status: 401 });
  }
  // getAuthUser reports a caregiver the age rule has locked out under this role.
  if (auth.role !== INELIGIBLE_CAREGIVER_ROLE) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_APPLICABLE', message: 'This account does not need to switch.' } },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({ where: { id: auth.userId }, data: { role: 'elder' } });
  const token = await createToken(user.id, user.role);
  const res = NextResponse.json({ success: true, data: { user: toSafeUser(user), token } });
  setSessionCookie(res, token);
  return res;
}
