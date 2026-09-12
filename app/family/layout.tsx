import { AppShell } from '@/components/app-shell';
import { getServerUser } from '@/lib/server-session';
import { getFamilySubscriptionState } from '@/lib/family-subscription';
import { FamilySubscriptionGate } from '@/components/family-subscription-gate';

/** Hard-blocks a caregiver whose family subscription has expired — checked
 *  here so it applies no matter which /family/* URL they land on (deep link,
 *  bookmark, or the normal post-login redirect), not just a one-time
 *  redirect from the login form. Still wrapped in the normal AppShell so
 *  they can navigate/log out; only the page content is replaced. Nothing
 *  changes for an elder, admin, or provider viewing under /family, or for a
 *  caregiver with no FamilySubscription row at all (grandfathered — see that
 *  model's own doc comment). */
export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  const blocked = user?.role === 'caregiver' && (await getFamilySubscriptionState(user.id)).blocked;

  return (
    <AppShell role="family" userName={user?.name}>
      {blocked ? <FamilySubscriptionGate /> : children}
    </AppShell>
  );
}
