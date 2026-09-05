import Link from 'next/link';
import { Store, Inbox, CalendarClock, Car, Scale, Home, ChevronRight, type LucideIcon } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getServerUser } from '@/lib/server-session';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProviderProfileClient } from './provider-profile-client';
import { CommunityRequestsClient } from './community-requests-client';
import { ProviderAccountClient } from './account-client';

export const dynamic = 'force-dynamic';

/** One category-specific management page per self-service module, each a
 *  dedicated route (not inline sections here) so they're reachable from the
 *  sidebar nav (components/app-shell.tsx) regardless of which category a
 *  provider is — a category that was only ever an inline conditional
 *  section, with no nav link, was easy to mistake for "doesn't exist". */
const CATEGORY_PAGES: { category: string; href: string; label: string; description: string; icon: LucideIcon }[] = [
  { category: 'doctor', href: '/provider/appointments', label: 'Appointments', description: 'Manage your bookable time slots and see who’s booked', icon: CalendarClock },
  { category: 'auto_transport', href: '/provider/transport', label: 'Your rates & listings', description: 'Manage your rates, WhatsApp number, and availability', icon: Car },
  { category: 'legal_help', href: '/provider/advisory', label: 'Advisory profile & consultations', description: 'Manage your profile and move consultations along', icon: Scale },
  { category: 'insurance', href: '/provider/advisory', label: 'Advisory profile & consultations', description: 'Manage your profile and move consultations along', icon: Scale },
  { category: 'property_management', href: '/provider/property-management', label: 'Rates, clients & inspections', description: 'Set your rates and submit inspection reports', icon: Home },
];

/**
 * Provider landing page.
 *
 * The full provider experience (ServiceRequest booking + assignment workflow) is
 * Phase C and genuinely isn't built yet — registration, a profile, and admin
 * verification are. Rather than show a fake dashboard of empty widgets, this states
 * plainly what a provider can do today and what's coming — a provider who sees
 * invented "0 requests" panels would reasonably assume the request system works and
 * that nobody is booking them.
 */
export default async function ProviderHomePage() {
  const user = await getServerUser();

  const [listings, provider] = user
    ? await Promise.all([
        prisma.localListing.findMany({
          where: { addedById: user.id },
          include: { neighborhood: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        prisma.serviceProvider.findUnique({ where: { userId: user.id } }),
      ])
    : [[], null];

  const categoryPage = CATEGORY_PAGES.find((c) => c.category === provider?.category);

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">
        {user?.name ? `Welcome, ${user.name}` : 'Provider'}
      </h1>
      <p className="mt-1 text-text-secondary">Your service provider account on EC.</p>

      {provider && (
        <div className="mt-6">
          <ProviderProfileClient initial={{ ...provider, featuredUntil: provider.featuredUntil?.toISOString() ?? null }} />
        </div>
      )}

      {provider && (
        <div className="mt-6">
          <CommunityRequestsClient />
        </div>
      )}

      {categoryPage && (
        <Link href={categoryPage.href} className="mt-6 block">
          <Card className="border-primary-100 bg-primary-50 transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 pt-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface">
                <categoryPage.icon className="h-5 w-5 text-primary-600" />
              </span>
              <div className="flex-1">
                <p className="font-bold text-text">{categoryPage.label}</p>
                <p className="text-sm text-text-secondary">{categoryPage.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-text-secondary" />
            </CardContent>
          </Card>
        </Link>
      )}

      <div className="mt-6">
        <ProviderAccountClient
          initial={{ name: user?.name ?? '', email: user?.email ?? null, phone: user?.phone ?? null }}
        />
      </div>

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
