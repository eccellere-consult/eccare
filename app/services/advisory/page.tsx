'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Scale, Home, ShieldCheck, Upload, FileText, Phone, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RatingInput } from '@/components/rating-input';
import { ProviderRatingSummaryDisplay } from '@/components/provider-rating-summary';

type Category = 'legal_will' | 'reverse_mortgage' | 'senior_insurance';
interface Expert {
  id: string;
  name: string;
  firmName: string | null;
  phone: string;
  bio: string | null;
  consultationFee: string | null;
}
interface VaultDoc {
  id: string;
  fileName: string;
  filePath: string;
}
interface Rating {
  stars: number;
  comment: string | null;
}
interface Consultation {
  id: string;
  category: Category;
  status: 'submitted' | 'in_progress' | 'completed' | 'closed';
  requirementDetails: Record<string, unknown>;
  assignedExpert: Expert | null;
  documents: VaultDoc[];
  createdAt: string;
  paidAt: string | null;
  razorpayOrderId: string | null;
  rating: Rating | null;
}

const CATEGORY_META: Record<Category, { label: string; description: string; icon: LucideIcon }> = {
  legal_will: { label: 'Legal & Will Services', description: 'Drafting a will, power of attorney, or property transfer', icon: Scale },
  reverse_mortgage: { label: 'Reverse Mortgage Advisory', description: 'Understand eligibility based on property value', icon: Home },
  senior_insurance: { label: 'Senior Insurance', description: 'Health, life, and critical illness coverage', icon: ShieldCheck },
};
const STATUS_VARIANT: Record<Consultation['status'], 'accent' | 'success'> = {
  submitted: 'accent',
  in_progress: 'accent',
  completed: 'success',
  closed: 'success',
};

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

function AdvisoryPageContent() {
  const elderUserId = useSearchParams().get('elderUserId') || undefined;
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const qs = elderUserId ? `?elderUserId=${elderUserId}` : '';
    fetch(`/api/v1/advisory/consultations${qs}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setConsultations(j.data); })
      .finally(() => setLoading(false));
  }, [elderUserId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <Link href="/services" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600">
        <ArrowLeft className="h-4 w-4" /> Services
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-text">Financial, Legal &amp; Advisory Services</h1>
      <p className="mt-1 text-text-secondary">Connect with verified, platform-partnered advisors for the things that matter most.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {(Object.entries(CATEGORY_META) as [Category, typeof CATEGORY_META[Category]][]).map(([key, meta]) => (
          <button key={key} type="button" onClick={() => setActiveCategory(key)} className="text-left">
            <Card className={`h-full transition-shadow hover:shadow-md ${activeCategory === key ? 'border-primary-600' : ''}`}>
              <CardContent className="pt-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
                  <meta.icon className="h-6 w-6 text-primary-600" />
                </span>
                <p className="mt-3 font-bold text-text">{meta.label}</p>
                <p className="mt-1 text-sm text-text-secondary">{meta.description}</p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {activeCategory && (
        <IntakeFunnel
          category={activeCategory}
          elderUserId={elderUserId}
          onSubmitted={() => { setActiveCategory(null); load(); }}
          onCancel={() => setActiveCategory(null)}
        />
      )}

      <div className="mt-8">
        <h2 className="text-lg font-bold text-text">Your requests</h2>
        {loading ? (
          <p className="mt-2 text-text-secondary">Loading…</p>
        ) : consultations.length === 0 ? (
          <Card className="mt-3"><CardContent className="py-12 text-center text-text-secondary">No requests yet — pick a service above to get started.</CardContent></Card>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {consultations.map((c) => (
              <ConsultationCard key={c.id} consultation={c} onUpdate={load} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdvisoryPage() {
  return (
    <Suspense>
      <AdvisoryPageContent />
    </Suspense>
  );
}

function IntakeFunnel({ category, elderUserId, onSubmitted, onCancel }: { category: Category; elderUserId?: string; onSubmitted: () => void; onCancel: () => void }) {
  const meta = CATEGORY_META[category];
  const [step, setStep] = useState(1);
  const [details, setDetails] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/v1/advisory/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ category, requirementDetails: details, notes: notes.trim() || undefined, elderUserId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not submit request.');
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mt-4 border-accent-100 bg-accent-50">
      <CardContent className="pt-6">
        <p className="text-sm font-bold text-accent-900">{meta.label} — Step {step} of 2</p>

        {step === 1 && (
          <div className="mt-3 flex flex-col gap-3">
            {category === 'legal_will' && (
              <div className="flex flex-col gap-2">
                <Label>What do you need?</Label>
                <div className="flex flex-wrap gap-2">
                  {['Registered Will', 'Power of Attorney', 'Property Transfer', 'Other'].map((opt) => (
                    <button key={opt} type="button" onClick={() => setDetails((d) => ({ ...d, documentType: opt }))} className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${details.documentType === opt ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary'}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {category === 'reverse_mortgage' && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="rm-value">Estimated property value (₹)</Label>
                  <Input id="rm-value" type="number" min="0" value={details.propertyValue ?? ''} onChange={(e) => setDetails((d) => ({ ...d, propertyValue: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="rm-city">Property city</Label>
                  <Input id="rm-city" value={details.city ?? ''} onChange={(e) => setDetails((d) => ({ ...d, city: e.target.value }))} />
                </div>
              </>
            )}
            {category === 'senior_insurance' && (
              <div className="flex flex-col gap-2">
                <Label>Insurance type</Label>
                <div className="flex flex-wrap gap-2">
                  {['Health', 'Life', 'Critical Illness'].map((opt) => (
                    <button key={opt} type="button" onClick={() => setDetails((d) => ({ ...d, insuranceType: opt }))} className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${details.insuranceType === opt ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary'}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Button size="sm" onClick={() => setStep(2)} className="w-fit">Next</Button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="adv-notes">Anything else the advisor should know? (optional)</Label>
              <Input id="adv-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {error && <p className="text-sm text-danger-600">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" disabled={submitting} onClick={submit}>{submitting ? 'Submitting…' : 'Submit request'}</Button>
              <Button size="sm" variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConsultationCard({ consultation: c, onUpdate }: { consultation: Consultation; onUpdate: () => void }) {
  const meta = CATEGORY_META[c.category];
  const [uploading, setUploading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [actionError, setActionError] = useState('');

  async function uploadDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      await fetch(`/api/v1/advisory/consultations/${c.id}/documents`, { method: 'POST', credentials: 'include', body });
      onUpdate();
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function pay() {
    setPaying(true);
    setActionError('');
    try {
      const payRes = await fetch(`/api/v1/advisory/consultations/${c.id}/pay`, { method: 'POST', credentials: 'include' }).then((r) => r.json());
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
        description: `Consultation fee — ${c.assignedExpert?.name ?? 'your advisor'}`,
        theme: { color: '#0B5563' },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const verifyRes = await fetch(`/api/v1/advisory/consultations/${c.id}/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            }),
          }).then((r) => r.json());
          if (!verifyRes.success) setActionError(verifyRes.error?.message || 'Payment could not be verified.');
          onUpdate();
          setPaying(false);
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      razorpay.open();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not start payment.');
      setPaying(false);
    }
  }

  async function close(stars: number, comment: string) {
    setClosing(true);
    setActionError('');
    try {
      const res = await fetch(`/api/v1/advisory/consultations/${c.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stars, comment: comment.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not confirm this request is resolved.');
      setShowRating(false);
      onUpdate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not confirm this request is resolved.');
    } finally {
      setClosing(false);
    }
  }

  const needsPayment = c.assignedExpert?.consultationFee != null && !c.paidAt;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
              <meta.icon className="h-5 w-5 text-primary-600" />
            </span>
            <p className="font-bold text-text">{meta.label}</p>
          </div>
          <Badge variant={STATUS_VARIANT[c.status]}>{c.status.replace('_', ' ')}</Badge>
        </div>

        {c.assignedExpert && (
          <div className="mt-3 rounded-xl border border-border p-3">
            <p className="text-sm font-semibold text-text">Your advisor: {c.assignedExpert.name}</p>
            {c.assignedExpert.firmName && <p className="text-xs text-text-secondary">{c.assignedExpert.firmName}</p>}
            <a href={`tel:${c.assignedExpert.phone}`} className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:underline">
              <Phone className="h-3 w-3" /> {c.assignedExpert.phone}
            </a>
            {c.assignedExpert.consultationFee != null && (
              <p className="mt-2 text-sm text-text-secondary">
                Consultation fee: ₹{c.assignedExpert.consultationFee}{' '}
                {c.paidAt ? <Badge variant="success">Paid</Badge> : <Badge variant="muted">Unpaid</Badge>}
              </p>
            )}
            {needsPayment && (
              <Button size="sm" className="mt-2" disabled={paying} onClick={pay}>
                {paying ? 'Opening…' : `Pay ₹${c.assignedExpert.consultationFee}`}
              </Button>
            )}
          </div>
        )}

        <div className="mt-3 border-t border-border pt-3">
          <p className="text-xs font-bold uppercase text-text-secondary">Document vault</p>
          <div className="mt-2 flex flex-col gap-1">
            {c.documents.map((doc) => (
              <a key={doc.id} href={doc.filePath} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-primary-600 hover:underline">
                <FileText className="h-3.5 w-3.5" /> {doc.fileName}
              </a>
            ))}
          </div>
          <label className="mt-2 flex w-fit cursor-pointer items-center gap-1.5 text-xs font-semibold text-primary-600 hover:underline">
            <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : 'Upload a document'}
            <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" disabled={uploading} onChange={uploadDoc} />
          </label>
        </div>

        {c.status === 'completed' && !showRating && (
          <div className="mt-3 border-t border-border pt-3">
            <Button size="sm" onClick={() => setShowRating(true)}>Confirm resolved</Button>
          </div>
        )}
        {c.status === 'completed' && showRating && (
          <div className="mt-3 border-t border-border pt-3">
            <RatingInput busy={closing} submitLabel="Confirm resolved" onSubmit={close} />
          </div>
        )}
        {c.status === 'closed' && c.rating && (
          <div className="mt-3 border-t border-border pt-3">
            <ProviderRatingSummaryDisplay summary={{ average: c.rating.stars, count: 1 }} />
            {c.rating.comment && <p className="mt-1 text-sm text-text-secondary">{c.rating.comment}</p>}
          </div>
        )}
        {actionError && <p className="mt-2 text-sm text-danger-600">{actionError}</p>}
      </CardContent>
    </Card>
  );
}
