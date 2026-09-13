'use client';

import { useState } from 'react';
import { Megaphone, Users, Phone, Pin, Store, Stethoscope, Car, IndianRupee, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCommunityData } from '@/lib/community-client';

interface Notice {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  createdBy: { id: string; name: string };
}
interface Neighbour {
  id: string;
  userId: string | null;
  name: string;
  phone: string | null;
  flatNumber: string | null;
  role: 'member' | 'committee' | 'admin' | null;
  isSelf: boolean;
  source: 'member' | 'contact';
}
interface Vendor {
  id: string;
  name: string;
  category: string;
  phone: string;
  address: string | null;
  verified: boolean;
}
interface Doctor {
  id: string;
  name: string;
  clinicName: string | null;
  specialty: string;
  locality: string | null;
  phone: string;
  consultationFee: string;
  provider: { verificationStatus: 'pending' | 'verified' | 'rejected' } | null;
}
interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicleNumber: string | null;
  serviceArea: string | null;
  perKmRate: string | null;
  perMinWaitRate: string | null;
  isAvailable: boolean;
}
interface RateCard {
  perKmRate: string;
  perMinWaitRate: string;
}

const TABS = [
  ['announcements', 'Announcements', Megaphone],
  ['directory', 'Directory', Users],
  ['vendors', 'Vendors', Store],
  ['doctors', 'Doctors', Stethoscope],
  ['auto', 'Auto Booking', Car],
] as const;
type Tab = (typeof TABS)[number][0];

function EmptyOrError({ loading, error, empty, emptyMessage }: { loading: boolean; error?: string | null; empty: boolean; emptyMessage: string }) {
  if (loading) return <p className="text-text-secondary">Loading…</p>;
  if (error) return <Card><CardContent className="py-8 text-center text-danger-600">{error}</CardContent></Card>;
  if (empty) return <Card><CardContent className="py-12 text-center text-text-secondary">{emptyMessage}</CardContent></Card>;
  return null;
}

/** Read-only "[Elder]'s Community" mode — announcements, directory, and
 *  browsing of vendors/doctors/auto-drivers for the elder's neighbourhood.
 *  Deliberately browse-only throughout: no posting, managing, booking, or
 *  ordering "as" the elder — a caregiver who wants to actually book/order
 *  needs to share the elder's own community (see the Services hub tiles,
 *  which work today for a co-located caregiver). Rendered by
 *  app/community/community-page-content.tsx when the caregiver's pill
 *  toggle is set to the elder. */
export function ElderCommunityView({ elderName, elderUserId }: { elderName: string; elderUserId: string }) {
  const [tab, setTab] = useState<Tab>('announcements');
  const qs = `?elderUserId=${elderUserId}`;
  const notices = useCommunityData<Notice[]>(`/community/notices${qs}`);
  const directory = useCommunityData<Neighbour[]>(`/community/directory${qs}`);
  const vendors = useCommunityData<Vendor[]>(`/community/vendors${qs}`);
  const doctors = useCommunityData<Doctor[]>(`/community/doctors${qs}`);
  const drivers = useCommunityData<Driver[]>(`/community/auto-drivers${qs}`);
  const rateCard = useCommunityData<RateCard | null>(`/community/auto-rate-card${qs}`);

  return (
    <div>
      <p className="text-text-secondary">
        Read-only — browsing {elderName}&rsquo;s residents association. Call directly for anything you need to arrange.
      </p>

      <div className="mt-4 flex h-12 w-fit min-w-[28rem] items-center rounded-xl bg-primary-50 p-1">
        {TABS.map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
              tab === value ? 'bg-surface text-primary-900 shadow-sm' : 'text-primary-900/70',
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'announcements' && (
          notices.loading || notices.error || (notices.data?.length ?? 0) === 0 ? (
            <EmptyOrError
              loading={notices.loading}
              error={notices.error}
              empty={(notices.data?.length ?? 0) === 0}
              emptyMessage={`${elderName} hasn't joined a community yet, or there are no announcements.`}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {notices.data!.map((n) => (
                <Card key={n.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-lg font-bold text-text">{n.title}</h2>
                      {n.pinned && (
                        <Badge variant="accent">
                          <Pin className="mr-1 h-3 w-3" /> Pinned
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-text">{n.body}</p>
                    <p className="mt-3 text-sm text-text-secondary">
                      {n.createdBy.name} · {new Date(n.createdAt).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}

        {tab === 'directory' && (
          directory.loading || directory.error || (directory.data?.length ?? 0) === 0 ? (
            <EmptyOrError loading={directory.loading} error={directory.error} empty={(directory.data?.length ?? 0) === 0} emptyMessage="No neighbours listed yet." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {directory.data!.map((n) => (
                <Card key={n.id}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50 text-lg font-bold text-primary-900">
                      {n.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-text">{n.name}</p>
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <span className="truncate">{n.flatNumber ?? '—'}</span>
                        {n.role && n.role !== 'member' && <Badge variant="accent">Committee</Badge>}
                        {n.source === 'contact' && <Badge variant="muted">Added by neighbour</Badge>}
                      </div>
                    </div>
                    {n.phone && (
                      <a
                        href={`tel:${n.phone}`}
                        aria-label={`Call ${n.name}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white"
                      >
                        <Phone className="h-5 w-5" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}

        {tab === 'vendors' && (
          vendors.loading || vendors.error || (vendors.data?.length ?? 0) === 0 ? (
            <EmptyOrError loading={vendors.loading} error={vendors.error} empty={(vendors.data?.length ?? 0) === 0} emptyMessage="No vendors listed yet." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {vendors.data!.map((v) => (
                <Card key={v.id}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                      <Store className="h-5 w-5 text-primary-600" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-text">{v.name}</p>
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <span className="truncate">{v.category}{v.address ? ` · ${v.address}` : ''}</span>
                        {v.verified && <Badge variant="success"><ShieldCheck className="mr-1 h-3 w-3" />verified</Badge>}
                      </div>
                    </div>
                    <a
                      href={`tel:${v.phone}`}
                      aria-label={`Call ${v.name}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white"
                    >
                      <Phone className="h-5 w-5" />
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}

        {tab === 'doctors' && (
          doctors.loading || doctors.error || (doctors.data?.length ?? 0) === 0 ? (
            <EmptyOrError loading={doctors.loading} error={doctors.error} empty={(doctors.data?.length ?? 0) === 0} emptyMessage="No doctors listed yet." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {doctors.data!.map((d) => (
                <Card key={d.id}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                      <Stethoscope className="h-5 w-5 text-primary-600" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-text">{d.name}</p>
                      <p className="text-sm text-text-secondary">{d.specialty}{d.clinicName ? ` · ${d.clinicName}` : ''}</p>
                      <p className="flex items-center gap-1 text-sm font-semibold text-primary-900">
                        <IndianRupee className="h-3 w-3" /> {d.consultationFee}
                      </p>
                    </div>
                    <a
                      href={`tel:${d.phone}`}
                      aria-label={`Call ${d.name}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white"
                    >
                      <Phone className="h-5 w-5" />
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}

        {tab === 'auto' && (
          drivers.loading || drivers.error || (drivers.data?.length ?? 0) === 0 ? (
            <EmptyOrError loading={drivers.loading} error={drivers.error} empty={(drivers.data?.length ?? 0) === 0} emptyMessage="No drivers listed yet." />
          ) : (
            <div className="flex flex-col gap-3">
              {rateCard.data && (
                <p className="text-sm text-text-secondary">
                  Default rate: ₹{rateCard.data.perKmRate}/km · ₹{rateCard.data.perMinWaitRate}/min waiting
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {drivers.data!.filter((d) => d.isAvailable).map((d) => (
                  <Card key={d.id}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                        <Car className="h-5 w-5 text-primary-600" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-text">{d.name}</p>
                        <p className="text-sm text-text-secondary">{d.vehicleNumber ?? d.serviceArea ?? ''}</p>
                        {(d.perKmRate || rateCard.data) && (
                          <p className="flex items-center gap-1 text-sm font-semibold text-primary-900">
                            <IndianRupee className="h-3 w-3" /> {d.perKmRate ?? rateCard.data?.perKmRate}/km
                          </p>
                        )}
                      </div>
                      <a
                        href={`tel:${d.phone}`}
                        aria-label={`Call ${d.name}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white"
                      >
                        <Phone className="h-5 w-5" />
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
