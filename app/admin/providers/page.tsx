'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface ProviderItem {
  id: string;
  businessName: string;
  category: string;
  serviceArea: string | null;
  certificationFileName: string | null;
  certificationFilePath: string | null;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  rejectionReason: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string | null; phone: string | null };
}

const STATUS_BADGE: Record<ProviderItem['verificationStatus'], 'accent' | 'success' | 'danger'> = {
  pending: 'accent',
  verified: 'success',
  rejected: 'danger',
};

export default function AdminProvidersPage() {
  const { data, loading, error, reload } = useCommunityData<ProviderItem[]>('/admin/providers');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  async function verify(id: string) {
    setBusyId(id);
    try {
      await communityApi.patch(`/admin/providers/${id}`, { verificationStatus: 'verified' });
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
      await communityApi.patch(`/admin/providers/${id}`, {
        verificationStatus: 'rejected',
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
      <h1 className="text-2xl font-bold text-text">Service providers</h1>
      <p className="mt-1 text-text-secondary">Review applications and verify certification before approving.</p>

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
            {data?.map((p) => (
              <Card key={p.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-text">{p.businessName}</p>
                      <p className="text-sm text-text-secondary">{p.category}{p.serviceArea ? ` · ${p.serviceArea}` : ''}</p>
                    </div>
                    <Badge variant={STATUS_BADGE[p.verificationStatus]}>{p.verificationStatus}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-text-secondary">
                    {p.user.name} · {p.user.email ?? '—'}{p.user.phone ? ` · ${p.user.phone}` : ''}
                  </p>
                  {p.certificationFilePath ? (
                    <a
                      href={p.certificationFilePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex items-center gap-2 text-sm font-semibold text-primary-600 hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      {p.certificationFileName ?? 'View certification'}
                    </a>
                  ) : (
                    <p className="mt-2 text-sm text-text-secondary">No certification uploaded.</p>
                  )}
                  {p.verificationStatus === 'rejected' && p.rejectionReason && (
                    <p className="mt-2 text-sm text-danger-600">{p.rejectionReason}</p>
                  )}

                  {p.verificationStatus === 'pending' && (
                    <div className="mt-4 flex flex-col gap-2">
                      {rejectingId === p.id ? (
                        <>
                          <Input
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection (optional)"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" variant="danger" disabled={busyId === p.id} onClick={() => reject(p.id)}>
                              Confirm reject
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setRejectingId(null); setRejectReason(''); }}>
                              Cancel
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="flex gap-2">
                          <Button size="sm" disabled={busyId === p.id} onClick={() => verify(p.id)}>
                            Verify
                          </Button>
                          <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => setRejectingId(p.id)}>
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
