'use client';

import { useState } from 'react';
import { Mail, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { interestLabel, type PartnerStatus } from '@/lib/partner-enquiry';

interface Enquiry {
  id: string;
  interest: string;
  name: string;
  organisation: string | null;
  phone: string;
  email: string | null;
  message: string;
  status: PartnerStatus;
  notifiedAt: string | null;
  createdAt: string;
}

const BADGE: Record<PartnerStatus, 'accent' | 'success' | 'danger'> = { new: 'accent', contacted: 'success', closed: 'danger' };
const NEXT: Record<PartnerStatus, { label: string; to: PartnerStatus }> = {
  new: { label: 'Mark as contacted', to: 'contacted' },
  contacted: { label: 'Close', to: 'closed' },
  closed: { label: 'Reopen', to: 'new' },
};

export default function AdminPartnerEnquiriesPage() {
  const { data, loading, error, reload } = useCommunityData<Enquiry[]>('/admin/partner-enquiries');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function move(id: string, status: PartnerStatus) {
    setBusyId(id);
    try {
      await communityApi.patch(`/admin/partner-enquiries/${id}`, { status });
      reload();
    } catch {
      /* the list reloads from the server on the next visit */
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Partner enquiries</h1>
      <p className="mt-1 text-text-secondary">
        Messages from companies and people who want to support EC (CSR funding, sponsoring elders, community and offline
        services), sent from the public Partner page. Nothing is paid on that page.
      </p>

      <div className="mt-6">
        {loading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center text-danger-600">{error}</CardContent>
          </Card>
        ) : (data?.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-text-secondary">No enquiries yet.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data?.map((e) => (
              <Card key={e.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-text">{e.name}{e.organisation ? ` · ${e.organisation}` : ''}</p>
                      <p className="text-sm text-text-secondary">{interestLabel(e.interest)}</p>
                    </div>
                    <Badge variant={BADGE[e.status]}>{e.status}</Badge>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-text">{e.message}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <a href={`tel:${e.phone}`} className="inline-flex items-center gap-1.5 font-semibold text-primary-600"><Phone className="h-4 w-4" />{e.phone}</a>
                    {e.email && <a href={`mailto:${e.email}`} className="inline-flex items-center gap-1.5 font-semibold text-primary-600"><Mail className="h-4 w-4" />{e.email}</a>}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-text-secondary">
                      {new Date(e.createdAt).toLocaleString('en-IN')} · {e.notifiedAt ? 'emailed to the team' : 'not emailed'}
                    </p>
                    <Button size="sm" variant="outline" disabled={busyId === e.id} onClick={() => move(e.id, NEXT[e.status].to)}>
                      {NEXT[e.status].label}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
