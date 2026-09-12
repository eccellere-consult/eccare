'use client';

import { useState } from 'react';
import { FileText, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface ApplicationDocument {
  id: string;
  kind: string;
  fileName: string;
  filePath: string;
}

interface ApplicationItem {
  id: string;
  placeName: string;
  applicantType: string | null;
  city: string | null;
  pincode: string;
  lat: number | null;
  lng: number | null;
  numberOfFamilies: number | null;
  applicantName: string;
  applicantPhone: string;
  applicantEmail: string | null;
  applicantDesignation: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  localityCode: string | null;
  createdAt: string;
  documents: ApplicationDocument[];
  neighborhood: { id: string; name: string; joinCode: string } | null;
}

const STATUS_BADGE: Record<ApplicationItem['status'], 'accent' | 'success' | 'danger'> = {
  pending: 'accent',
  approved: 'success',
  rejected: 'danger',
};

export default function AdminCommunityApplicationsPage() {
  const { data, loading, error, reload } = useCommunityData<ApplicationItem[]>('/admin/community-applications');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  async function approve(id: string) {
    setBusyId(id);
    try {
      await communityApi.patch(`/admin/community-applications/${id}`, { action: 'approve' });
      reload();
    } catch {
      /* surfaced via reload's own error state on next load */
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    setBusyId(id);
    try {
      await communityApi.patch(`/admin/community-applications/${id}`, {
        action: 'reject',
        rejectionReason: rejectReason || undefined,
      });
      setRejectingId(null);
      setRejectReason('');
      reload();
    } catch {
      /* ignore — reload will still show the item if the update failed */
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Community registration applications</h1>
      <p className="mt-1 text-text-secondary">
        Review a residents&rsquo; association or local authority&rsquo;s application before allocating a
        locality code.
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
            <CardContent className="py-12 text-center text-text-secondary">No applications yet.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data?.map((a) => (
              <Card key={a.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-text">{a.placeName}</p>
                      <p className="text-sm text-text-secondary">
                        {a.applicantType ?? 'Applicant'} · {a.pincode}{a.city ? `, ${a.city}` : ''}
                      </p>
                    </div>
                    <Badge variant={STATUS_BADGE[a.status]}>{a.status}</Badge>
                  </div>

                  <p className="mt-3 text-sm text-text-secondary">
                    {a.applicantName}{a.applicantDesignation ? ` (${a.applicantDesignation})` : ''} · {a.applicantPhone}
                    {a.applicantEmail ? ` · ${a.applicantEmail}` : ''}
                  </p>
                  {a.numberOfFamilies !== null && (
                    <p className="mt-1 text-sm text-text-secondary">{a.numberOfFamilies} families</p>
                  )}
                  {a.lat !== null && a.lng !== null && (
                    <a
                      href={`https://maps.google.com/?q=${a.lat},${a.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex items-center gap-2 text-sm font-semibold text-primary-600 hover:underline"
                    >
                      <MapPin className="h-4 w-4" /> View location
                    </a>
                  )}

                  <div className="mt-3 flex flex-col gap-1">
                    {a.documents.map((d) => (
                      <a
                        key={d.id}
                        href={d.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm font-semibold text-primary-600 hover:underline"
                      >
                        <FileText className="h-4 w-4" />
                        {d.kind === 'proof_of_authority' ? 'Proof of authority' : 'Additional document'} — {d.fileName}
                      </a>
                    ))}
                  </div>

                  {a.status === 'approved' && a.localityCode && (
                    <p className="mt-3 text-sm text-success-600">
                      Locality code <span className="font-mono font-bold">{a.localityCode}</span>
                      {a.neighborhood && <> · Join code <span className="font-mono font-bold">{a.neighborhood.joinCode}</span></>}
                    </p>
                  )}
                  {a.status === 'rejected' && a.rejectionReason && (
                    <p className="mt-2 text-sm text-danger-600">{a.rejectionReason}</p>
                  )}

                  {a.status === 'pending' && (
                    <div className="mt-4 flex flex-col gap-2">
                      {rejectingId === a.id ? (
                        <>
                          <Input
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection (optional)"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" variant="danger" disabled={busyId === a.id} onClick={() => reject(a.id)}>
                              Confirm reject
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setRejectingId(null); setRejectReason(''); }}>
                              Cancel
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="flex gap-2">
                          <Button size="sm" disabled={busyId === a.id} onClick={() => approve(a.id)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" disabled={busyId === a.id} onClick={() => setRejectingId(a.id)}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
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
