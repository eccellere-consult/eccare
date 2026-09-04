'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Home, CheckCircle2, XCircle, AlertTriangle, Image as ImageIcon, IndianRupee } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PROPERTY_REVIEW_RATES } from '@/lib/property-rates';

type Frequency = 'monthly' | 'quarterly' | 'biannually';
type ChecklistStatus = 'pass' | 'fail' | 'needs_attention';
interface Invoice {
  id: string;
  amount: string;
  status: 'pending' | 'paid';
}
interface RepairEstimate {
  id: string;
  itemDescription: string;
  estimatedCost: string;
  isApproved: boolean;
  invoice: Invoice | null;
}
interface Inspection {
  id: string;
  inspectedAt: string;
  plumbingStatus: ChecklistStatus;
  electricalStatus: ChecklistStatus;
  structuralStatus: ChecklistStatus;
  notes: string | null;
  mediaPaths: string[];
  repairEstimates: RepairEstimate[];
}
interface Subscription {
  id: string;
  frequency: Frequency;
  status: 'active' | 'paused' | 'cancelled';
  fee: string;
  inspections: Inspection[];
}

const FREQUENCY_LABEL: Record<Frequency, string> = { monthly: 'Monthly', quarterly: 'Quarterly', biannually: 'Bi-annually' };
const CHECKLIST_ICON: Record<ChecklistStatus, typeof CheckCircle2> = { pass: CheckCircle2, fail: XCircle, needs_attention: AlertTriangle };
const CHECKLIST_COLOR: Record<ChecklistStatus, string> = { pass: 'text-success-600', fail: 'text-danger-600', needs_attention: 'text-accent-600' };

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PropertyManagementPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subscribing, setSubscribing] = useState<Frequency | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/v1/health/property-subscriptions', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setSubscriptions(j.data); })
      .catch(() => setError('Could not load subscriptions.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function subscribe(frequency: Frequency) {
    setSubscribing(frequency);
    setError('');
    try {
      const res = await fetch('/api/v1/health/property-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ frequency }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not subscribe.');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not subscribe.');
    } finally {
      setSubscribing(null);
    }
  }

  async function updateStatus(id: string, status: Subscription['status']) {
    await fetch(`/api/v1/health/property-subscriptions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function approve(estimateId: string) {
    setApprovingId(estimateId);
    try {
      const res = await fetch(`/api/v1/repair-estimates/${estimateId}/approve`, { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not approve.');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve.');
    } finally {
      setApprovingId(null);
    }
  }

  const pay = useCallback(async (invoice: Invoice, description: string) => {
    setPayingId(invoice.id);
    setError('');
    try {
      const payRes = await fetch(`/api/v1/property-invoices/${invoice.id}/pay`, { method: 'POST', credentials: 'include' }).then((r) => r.json());
      if (!payRes.success) throw new Error(payRes.error?.message || 'Could not start payment.');
      const { razorpayOrderId, amount, keyId } = payRes.data;

      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Could not load the payment page.');

      const razorpay = new window.Razorpay({
        key: keyId,
        amount,
        currency: 'INR',
        order_id: razorpayOrderId,
        name: 'EC',
        description,
        theme: { color: '#0B5563' },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const verifyRes = await fetch(`/api/v1/property-invoices/${invoice.id}/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            }),
          }).then((r) => r.json());
          if (!verifyRes.success) setError(verifyRes.error?.message || 'Payment could not be verified.');
          load();
          setPayingId(null);
        },
        modal: { ondismiss: () => setPayingId(null) },
      });
      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment.');
      setPayingId(null);
    }
  }, [load]);

  return (
    <div>
      <Link href="/services" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600">
        <ArrowLeft className="h-4 w-4" /> Services
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-text">Property Management &amp; Maintenance</h1>
      <p className="mt-1 text-text-secondary">Periodic home reviews, inspection reports, and repair estimates for an elder's home.</p>

      {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}

      {loading ? (
        <p className="mt-4 text-text-secondary">Loading…</p>
      ) : subscriptions.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <p className="text-sm font-bold text-text">Subscribe to a review plan</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((freq) => (
                <button key={freq} type="button" disabled={subscribing === freq} onClick={() => subscribe(freq)} className="rounded-2xl border border-border p-4 text-left hover:border-primary-600 hover:bg-primary-50 disabled:opacity-50">
                  <p className="font-bold text-text">{FREQUENCY_LABEL[freq]}</p>
                  <p className="mt-1 flex items-center gap-1 text-sm text-primary-900"><IndianRupee className="h-3.5 w-3.5" />{PROPERTY_REVIEW_RATES[freq]}</p>
                  <p className="mt-1 text-xs text-text-secondary">{subscribing === freq ? 'Subscribing…' : 'Tap to subscribe'}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        subscriptions.map((sub) => (
          <Card key={sub.id} className="mt-4">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                    <Home className="h-5 w-5 text-primary-600" />
                  </span>
                  <div>
                    <p className="font-bold text-text">{FREQUENCY_LABEL[sub.frequency]} property review — ₹{sub.fee}</p>
                    <Badge variant={sub.status === 'active' ? 'success' : 'muted'}>{sub.status}</Badge>
                  </div>
                </div>
                {sub.status === 'active' ? (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(sub.id, 'paused')}>Pause</Button>
                ) : sub.status === 'paused' ? (
                  <Button size="sm" onClick={() => updateStatus(sub.id, 'active')}>Resume</Button>
                ) : null}
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                <p className="text-sm font-bold text-text">Inspection history</p>
                {sub.inspections.length === 0 ? (
                  <p className="text-sm text-text-secondary">No inspections yet.</p>
                ) : (
                  sub.inspections.map((insp) => (
                    <div key={insp.id} className="rounded-xl border border-border p-3">
                      <p className="text-xs text-text-secondary">{new Date(insp.inspectedAt).toLocaleDateString('en-IN')}</p>
                      <div className="mt-2 flex flex-wrap gap-3">
                        {(['plumbingStatus', 'electricalStatus', 'structuralStatus'] as const).map((key) => {
                          const status = insp[key];
                          const Icon = CHECKLIST_ICON[status];
                          return (
                            <span key={key} className={`flex items-center gap-1 text-xs font-semibold ${CHECKLIST_COLOR[status]}`}>
                              <Icon className="h-3.5 w-3.5" /> {key.replace('Status', '')}: {status.replace('_', ' ')}
                            </span>
                          );
                        })}
                      </div>
                      {insp.notes && <p className="mt-2 text-sm text-text-secondary">{insp.notes}</p>}
                      {insp.mediaPaths.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {insp.mediaPaths.map((path, i) => (
                            <a key={i} href={path} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary-600 hover:underline">
                              <ImageIcon className="h-3 w-3" /> Media {i + 1}
                            </a>
                          ))}
                        </div>
                      )}
                      {insp.repairEstimates.length > 0 && (
                        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-2">
                          {insp.repairEstimates.map((est) => (
                            <div key={est.id} className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-text">{est.itemDescription}</p>
                                <p className="text-xs text-text-secondary">Estimated ₹{est.estimatedCost}</p>
                              </div>
                              {!est.isApproved ? (
                                <Button size="sm" disabled={approvingId === est.id} onClick={() => approve(est.id)}>
                                  {approvingId === est.id ? 'Approving…' : 'Approve'}
                                </Button>
                              ) : est.invoice?.status === 'pending' ? (
                                <Button size="sm" disabled={payingId === est.invoice.id} onClick={() => pay(est.invoice!, est.itemDescription)}>
                                  {payingId === est.invoice.id ? 'Opening…' : `Pay ₹${est.invoice.amount}`}
                                </Button>
                              ) : (
                                <Badge variant="success">Paid</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
