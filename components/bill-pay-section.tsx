'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, Droplet, Landmark, Tv, Smartphone, ShieldCheck, MoreHorizontal, Plus, Trash2, Bell, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type BillerType = 'electricity' | 'water' | 'property_tax' | 'cable_tv' | 'mobile' | 'insurance' | 'other';
interface Bill {
  id: string;
  amount: string;
  dueDate: string | null;
  status: 'due' | 'paid';
}
interface Biller {
  id: string;
  billerType: BillerType;
  billerName: string;
  consumerNumber: string;
  nickname: string | null;
  autopayEnabled: boolean;
  bills: Bill[];
}

const BILLER_META: Record<BillerType, { label: string; icon: LucideIcon }> = {
  electricity: { label: 'Electricity', icon: Zap },
  water: { label: 'Water', icon: Droplet },
  property_tax: { label: 'Property Tax', icon: Landmark },
  cable_tv: { label: 'Cable / DTH', icon: Tv },
  mobile: { label: 'Mobile', icon: Smartphone },
  insurance: { label: 'Insurance', icon: ShieldCheck },
  other: { label: 'Other', icon: MoreHorizontal },
};
const BILLER_TYPES = Object.keys(BILLER_META) as BillerType[];

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

/** Shared between the elder's own Health page and the family per-elder page —
 *  same caregiver-writes/elder-reads convention as HealthEssentials. Bill
 *  payment is a direct Razorpay pass-through, no stored wallet balance. */
export function BillPaySection({ elderUserId }: { elderUserId?: string }) {
  const qs = elderUserId ? `?elderUserId=${elderUserId}` : '';
  const [billers, setBillers] = useState<Biller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/v1/health/billers${qs}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setBillers(j.data); })
      .catch(() => setError('Could not load linked billers.'))
      .finally(() => setLoading(false));
  }, [qs]);

  useEffect(() => { load(); }, [load]);

  const [showAddBiller, setShowAddBiller] = useState(false);
  const [billerForm, setBillerForm] = useState({ billerType: 'electricity' as BillerType, billerName: '', consumerNumber: '', nickname: '' });
  const [addingBiller, setAddingBiller] = useState(false);

  const [addingBillFor, setAddingBillFor] = useState<string | null>(null);
  const [billForm, setBillForm] = useState({ amount: '', dueDate: '' });
  const [savingBill, setSavingBill] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  async function addBiller(e: React.FormEvent) {
    e.preventDefault();
    setAddingBiller(true);
    setError('');
    try {
      const res = await fetch('/api/v1/health/billers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ elderUserId, ...billerForm, billerName: billerForm.billerName.trim(), consumerNumber: billerForm.consumerNumber.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not link biller.');
      setBillerForm({ billerType: 'electricity', billerName: '', consumerNumber: '', nickname: '' });
      setShowAddBiller(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link biller.');
    } finally {
      setAddingBiller(false);
    }
  }

  async function toggleAutopay(biller: Biller) {
    await fetch(`/api/v1/health/billers/${biller.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ autopayEnabled: !biller.autopayEnabled }),
    });
    load();
  }

  async function removeBiller(id: string) {
    if (!confirm('Unlink this biller?')) return;
    await fetch(`/api/v1/health/billers/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  async function addBill(billerId: string) {
    if (!billForm.amount) return;
    setSavingBill(true);
    try {
      const res = await fetch(`/api/v1/health/billers/${billerId}/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: Number(billForm.amount),
          dueDate: billForm.dueDate ? new Date(billForm.dueDate).toISOString() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not add bill.');
      setBillForm({ amount: '', dueDate: '' });
      setAddingBillFor(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add bill.');
    } finally {
      setSavingBill(false);
    }
  }

  const pay = useCallback(async (bill: Bill, billerName: string) => {
    setPayingId(bill.id);
    setError('');
    try {
      const payRes = await fetch(`/api/v1/health/bills/${bill.id}/pay`, { method: 'POST', credentials: 'include' }).then((r) => r.json());
      if (!payRes.success) throw new Error(payRes.error?.message || 'Could not start payment.');
      const { razorpayOrderId, amount, keyId } = payRes.data;

      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Could not load the payment page. Please check your connection and try again.');

      const razorpay = new window.Razorpay({
        key: keyId,
        amount,
        currency: 'INR',
        order_id: razorpayOrderId,
        name: 'EC',
        description: `${billerName} bill`,
        theme: { color: '#0B5563' },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const verifyRes = await fetch(`/api/v1/health/bills/${bill.id}/verify-payment`, {
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
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-lg font-bold text-text">
        <Zap className="h-5 w-5 text-primary-600" />
        Bill Pay
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Link utility and service accounts, pay bills directly — no wallet or stored balance, each
        payment goes straight through our payment gateway.
      </p>

      {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}

      <div className="mt-3">
        <Button size="sm" variant="outline" onClick={() => setShowAddBiller((s) => !s)}>
          <Plus className="h-4 w-4" /> {showAddBiller ? 'Cancel' : 'Link a biller'}
        </Button>
        {showAddBiller && (
          <Card className="mt-2">
            <CardContent className="pt-6">
              <form onSubmit={addBiller} className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="b-type">Type</Label>
                  <select
                    id="b-type"
                    value={billerForm.billerType}
                    onChange={(e) => setBillerForm((f) => ({ ...f, billerType: e.target.value as BillerType }))}
                    className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  >
                    {BILLER_TYPES.map((t) => (
                      <option key={t} value={t}>{BILLER_META[t].label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="b-name">Provider name</Label>
                  <Input id="b-name" value={billerForm.billerName} onChange={(e) => setBillerForm((f) => ({ ...f, billerName: e.target.value }))} placeholder="KSEB, Airtel, BWSSB…" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="b-consumer">Consumer / account number</Label>
                  <Input id="b-consumer" value={billerForm.consumerNumber} onChange={(e) => setBillerForm((f) => ({ ...f, consumerNumber: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="b-nick">Nickname (optional)</Label>
                  <Input id="b-nick" value={billerForm.nickname} onChange={(e) => setBillerForm((f) => ({ ...f, nickname: e.target.value }))} placeholder="Home electricity" />
                </div>
                <Button type="submit" disabled={addingBiller || !billerForm.billerName.trim() || !billerForm.consumerNumber.trim()} className="w-fit sm:col-span-2">
                  {addingBiller ? 'Linking…' : 'Link biller'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : billers.length === 0 ? (
          <p className="text-sm text-text-secondary">No billers linked yet.</p>
        ) : (
          billers.map((biller) => {
            const Icon = BILLER_META[biller.billerType].icon;
            return (
              <Card key={biller.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                        <Icon className="h-5 w-5 text-primary-600" />
                      </span>
                      <div>
                        <p className="font-bold text-text">{biller.nickname || biller.billerName}</p>
                        <p className="text-xs text-text-secondary">{BILLER_META[biller.billerType].label} · {biller.consumerNumber}</p>
                      </div>
                    </div>
                    <button onClick={() => removeBiller(biller.id)} aria-label="Unlink" className="text-text-secondary hover:text-danger-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <label className="mt-3 flex items-center gap-2 text-sm text-text">
                    <input type="checkbox" checked={biller.autopayEnabled} onChange={() => toggleAutopay(biller)} className="h-5 w-5 rounded border-border" />
                    <Bell className="h-4 w-4 text-accent-600" />
                    Autopay alerts — notify me instantly with a one-tap pay link when a bill is added
                  </label>

                  {biller.bills.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                      {biller.bills.map((bill) => (
                        <div key={bill.id} className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-text">₹{bill.amount}</p>
                            {bill.dueDate && <p className="text-xs text-text-secondary">Due {new Date(bill.dueDate).toLocaleDateString('en-IN')}</p>}
                          </div>
                          <Button size="sm" disabled={payingId === bill.id} onClick={() => pay(bill, biller.billerName)}>
                            {payingId === bill.id ? 'Opening…' : 'Pay now'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3">
                    {addingBillFor === biller.id ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`amt-${biller.id}`} className="text-xs">Amount (₹)</Label>
                          <Input id={`amt-${biller.id}`} type="number" min="0" value={billForm.amount} onChange={(e) => setBillForm((f) => ({ ...f, amount: e.target.value }))} className="w-28" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`due-${biller.id}`} className="text-xs">Due date</Label>
                          <Input id={`due-${biller.id}`} type="date" value={billForm.dueDate} onChange={(e) => setBillForm((f) => ({ ...f, dueDate: e.target.value }))} />
                        </div>
                        <Button size="sm" disabled={savingBill || !billForm.amount} onClick={() => addBill(biller.id)}>
                          {savingBill ? 'Adding…' : 'Add'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAddingBillFor(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setAddingBillFor(biller.id)}>
                        <Plus className="h-3.5 w-3.5" /> Record a new bill
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </section>
  );
}
