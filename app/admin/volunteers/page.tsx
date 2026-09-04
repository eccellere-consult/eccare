'use client';

import { useState } from 'react';
import { HeartHandshake } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface VolunteerItem {
  id: string;
  availability: 'weekdays' | 'weekends' | 'always';
  assistanceTypes: string[];
  verificationStatus: 'pending' | 'verified' | 'rejected';
  createdAt: string;
  user: { id: string; name: string; email: string | null; phone: string | null };
}

const STATUS_BADGE: Record<VolunteerItem['verificationStatus'], 'accent' | 'success' | 'danger'> = {
  pending: 'accent',
  verified: 'success',
  rejected: 'danger',
};
const AVAILABILITY_LABEL: Record<VolunteerItem['availability'], string> = {
  weekdays: 'Weekdays',
  weekends: 'Weekends',
  always: '24/7',
};
const ASSISTANCE_LABEL: Record<string, string> = {
  medical_runs: 'Medical Runs',
  companionship: 'Companionship',
  errands: 'Errands',
  tech_support: 'Tech Support',
};

export default function AdminVolunteersPage() {
  const { data, loading, error, reload } = useCommunityData<VolunteerItem[]>('/admin/volunteers');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setStatus(id: string, verificationStatus: VolunteerItem['verificationStatus']) {
    setBusyId(id);
    try {
      await communityApi.patch(`/admin/volunteers/${id}`, { verificationStatus });
      reload();
    } catch {
      /* surfaced via reload's own error state on next load */
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Community Volunteers</h1>
      <p className="mt-1 text-text-secondary">
        Review volunteer registrations — only verified volunteers appear in the community directory.
      </p>

      <div className="mt-6">
        {loading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : error ? (
          <Card><CardContent className="py-8 text-center text-danger-600">{error}</CardContent></Card>
        ) : (data?.length ?? 0) === 0 ? (
          <Card><CardContent className="py-12 text-center text-text-secondary">No volunteer registrations yet.</CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data?.map((v) => (
              <Card key={v.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                        <HeartHandshake className="h-5 w-5 text-primary-600" />
                      </span>
                      <div>
                        <p className="font-bold text-text">{v.user.name}</p>
                        <p className="text-xs text-text-secondary">{v.user.phone ?? v.user.email ?? '—'}</p>
                      </div>
                    </div>
                    <Badge variant={STATUS_BADGE[v.verificationStatus]}>{v.verificationStatus}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-text-secondary">
                    <strong className="text-text">Availability:</strong> {AVAILABILITY_LABEL[v.availability]}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    <strong className="text-text">Can help with:</strong>{' '}
                    {v.assistanceTypes.map((t) => ASSISTANCE_LABEL[t] ?? t).join(', ')}
                  </p>
                  {v.verificationStatus !== 'verified' && (
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" disabled={busyId === v.id} onClick={() => setStatus(v.id, 'verified')}>
                        Verify
                      </Button>
                      {v.verificationStatus !== 'rejected' && (
                        <Button size="sm" variant="outline" disabled={busyId === v.id} onClick={() => setStatus(v.id, 'rejected')}>
                          Reject
                        </Button>
                      )}
                    </div>
                  )}
                  {v.verificationStatus === 'verified' && (
                    <Button size="sm" variant="outline" className="mt-4" disabled={busyId === v.id} onClick={() => setStatus(v.id, 'rejected')}>
                      Revoke verification
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
