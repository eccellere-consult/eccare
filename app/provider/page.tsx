import { Store, Inbox, BadgeCheck } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getServerUser } from '@/lib/server-session';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

/**
 * Provider landing page.
 *
 * The full provider experience (ServiceRequest booking + assignment workflow, admin
 * verification queue) is Phase C and genuinely isn't built yet. Rather than show a
 * fake dashboard of empty widgets, this states plainly what a provider can do today
 * and what's coming — a provider who sees invented "0 requests" panels would
 * reasonably assume the request system works and that nobody is booking them.
 */
export default async function ProviderHomePage() {
  const user = await getServerUser();

  // Vendor listings this provider has been added to across communities is the one
  // genuinely useful signal available today.
  const listings = user
    ? await prisma.localListing.findMany({
        where: { addedById: user.id },
        include: { neighborhood: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">
        {user?.name ? `Welcome, ${user.name}` : 'Provider'}
      </h1>
      <p className="mt-1 text-text-secondary">Your service provider account on EC.</p>

      <Card className="mt-6">
        <CardContent className="flex items-start gap-4 pt-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
            <BadgeCheck className="h-6 w-6 text-primary-600" />
          </span>
          <div>
            <p className="font-bold text-text">Account active</p>
            <p className="text-sm text-text-secondary">
              {user?.email ?? '—'} · Service provider
            </p>
          </div>
        </CardContent>
      </Card>

      <h2 className="mt-8 text-lg font-bold text-text">Your listings</h2>
      {listings.length === 0 ? (
        <Card className="mt-3">
          <CardContent className="py-10 text-center text-text-secondary">
            You&rsquo;re not listed in any community directory yet. Residents or their management
            committee can add your business to their community&rsquo;s vendor list.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {listings.map((l) => (
            <Card key={l.id}>
              <CardContent className="flex items-start gap-4 pt-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50">
                  <Store className="h-5 w-5 text-primary-600" />
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-text">{l.name}</p>
                  <p className="text-sm text-text-secondary">
                    {l.category}
                    {l.neighborhood?.name ? ` · ${l.neighborhood.name}` : ''}
                  </p>
                  {l.verified && (
                    <Badge variant="success" className="mt-2">Verified</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-8 border-accent-100 bg-accent-50">
        <CardContent className="flex items-start gap-4 pt-6">
          <Inbox className="h-6 w-6 shrink-0 text-accent-600" />
          <div>
            <p className="font-bold text-text">Booking requests are coming</p>
            <p className="mt-1 text-sm text-text-secondary">
              Accepting and managing service requests from residents is not available yet. For now,
              residents contact you directly using the phone number in their community&rsquo;s vendor
              directory.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
