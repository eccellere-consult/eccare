import Link from 'next/link';
import { ArrowLeft, CalendarClock } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getServerUser } from '@/lib/server-session';
import { Card, CardContent } from '@/components/ui/card';
import { DoctorSelfService } from '@/components/provider/doctor-self-service';

export const dynamic = 'force-dynamic';

/**
 * A dedicated, always-reachable page for a doctor's own appointment/slot
 * management — this used to only exist as a section on the Provider
 * Overview page, conditionally rendered when category === 'doctor', with
 * no nav link pointing to it. That made it easy to miss entirely (if the
 * category didn't match exactly, or the admin/provider simply didn't
 * scroll past the profile/community-join sections above it, there was
 * nothing distinguishing "not applicable" from "doesn't exist"). Giving it
 * its own page + nav link (see components/app-shell.tsx) makes it
 * unambiguous either way.
 */
export default async function ProviderAppointmentsPage() {
  const user = await getServerUser();
  const provider = user ? await prisma.serviceProvider.findUnique({ where: { userId: user.id } }) : null;

  const backLink = (
    <Link href="/provider" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600">
      <ArrowLeft className="h-4 w-4" /> Provider home
    </Link>
  );

  if (!provider) {
    return (
      <div>
        {backLink}
        <h1 className="mt-3 text-2xl font-bold text-text">Appointments</h1>
        <Card className="mt-4">
          <CardContent className="py-10 text-center text-text-secondary">
            Complete your service provider profile first.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (provider.category !== 'doctor') {
    return (
      <div>
        {backLink}
        <h1 className="mt-3 text-2xl font-bold text-text">Appointments</h1>
        <Card className="mt-4">
          <CardContent className="flex items-start gap-4 py-8">
            <CalendarClock className="h-6 w-6 shrink-0 text-text-secondary" />
            <div>
              <p className="font-bold text-text">This page is for Doctor accounts</p>
              <p className="mt-1 text-sm text-text-secondary">
                Your account is registered under &ldquo;{provider.category}&rdquo;. Appointment and slot
                management is specific to the Doctor category — if that&rsquo;s a mistake, update your
                category on your provider profile.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const doctorRows = await prisma.localDoctor.findMany({
    where: { providerId: provider.id },
    include: {
      neighborhood: { select: { id: true, name: true } },
      slots: { where: { isBooked: false, startsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const doctors = doctorRows.map((d) => ({
    ...d,
    consultationFee: d.consultationFee.toString(),
    slots: d.slots.map((s) => ({ ...s, startsAt: s.startsAt.toISOString() })),
  }));

  return (
    <div>
      {backLink}
      <h1 className="mt-3 text-2xl font-bold text-text">Appointments</h1>
      <p className="mt-1 text-text-secondary">
        Manage your own bookable time slots and see who&rsquo;s booked — no admin in the loop.
      </p>
      <DoctorSelfService initial={doctors} />
    </div>
  );
}
