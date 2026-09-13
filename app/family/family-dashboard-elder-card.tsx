'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Phone, Clock, Settings, CalendarClock, Pill } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Reminder {
  id: string;
  status: 'pending' | 'taken' | 'missed' | 'snoozed';
}
interface SosEvent {
  id: string;
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: string;
}
interface Appointment {
  id: string;
  doctorName: string;
  datetime: string;
}
interface DashboardData {
  recentSos: SosEvent[];
  todayReminders: Reminder[];
  upcomingAppointments: Appointment[];
}

const RECENT_SOS_WINDOW_MS = 24 * 60 * 60 * 1000;

/** One elder's "at a glance" status on the caregiver dashboard — SOS status,
 *  today's medication adherence, and the next appointment — all from the
 *  aggregate GET /api/v1/family/dashboard/{elderId} endpoint (already existed,
 *  just wasn't wired to any page before this). One fetch per card, mirroring
 *  how app/elder/elder-home-client.tsx fetches its own supplementary data. */
export function FamilyDashboardElderCard({
  elderId,
  elderName,
  phone,
  relationship,
  connectedSince,
}: {
  elderId: string;
  elderName: string;
  phone: string | null;
  relationship: string;
  connectedSince: string;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/family/dashboard/${elderId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setData(j.data); })
      .finally(() => setLoading(false));
  }, [elderId]);

  const recentSos = data?.recentSos?.[0];
  const sosNeedsAttention =
    recentSos &&
    recentSos.status !== 'resolved' &&
    Date.now() - new Date(recentSos.createdAt).getTime() < RECENT_SOS_WINDOW_MS;

  const takenCount = data?.todayReminders.filter((r) => r.status === 'taken').length ?? 0;
  const totalCount = data?.todayReminders.length ?? 0;
  const nextAppointment = data?.upcomingAppointments?.[0];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{elderName}</CardTitle>
          <CardDescription>{relationship}</CardDescription>
        </div>
        <Link
          href={`/family/elder/${elderId}/settings`}
          aria-label={`Language settings for ${elderName}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary hover:bg-primary-50 hover:text-primary-900"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
          {phone && (
            <span className="flex items-center gap-1.5">
              <Phone className="h-4 w-4" />
              {phone}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            Connected {connectedSince}
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : (
          <>
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                sosNeedsAttention ? 'bg-danger-50 text-danger-900' : 'bg-success-50 text-success-900'
              }`}
            >
              {sosNeedsAttention ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {sosNeedsAttention
                ? `Needs attention — SOS at ${new Date(recentSos!.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'All clear'}
            </div>

            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Pill className="h-4 w-4 shrink-0" />
              {totalCount === 0 ? (
                <span>No doses scheduled today</span>
              ) : (
                <span>
                  {takenCount} of {totalCount} doses taken today
                  {takenCount < totalCount && (
                    <Badge variant="accent" className="ml-2">
                      {totalCount - takenCount} pending
                    </Badge>
                  )}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <CalendarClock className="h-4 w-4 shrink-0" />
              {nextAppointment ? (
                <span>
                  {nextAppointment.doctorName} — {new Date(nextAppointment.datetime).toLocaleDateString()}
                </span>
              ) : (
                <span>No upcoming appointments</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
