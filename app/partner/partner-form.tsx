'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PARTNER_INTERESTS } from '@/lib/partner-enquiry';

export function PartnerForm() {
  const [interest, setInterest] = useState<string>(PARTNER_INTERESTS[0].value);
  const [name, setName] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [companyUrl, setCompanyUrl] = useState(''); // hidden trap field for automated form-fillers
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/v1/partner-enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interest, name, organisation, phone, email, message, companyUrl }),
      }).then((r) => r.json());
      if (!res.success) throw new Error(res.error?.message || 'Could not send your message. Please try again.');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-success-600" />
        <h3 className="text-lg font-bold text-text">Thank you</h3>
        <p className="text-text-secondary">We have your message and will contact you soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pf-interest">I am interested in</Label>
        <select
          id="pf-interest"
          value={interest}
          onChange={(e) => setInterest(e.target.value)}
          className="flex h-11 w-full rounded-xl border border-border bg-surface px-3 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 pointer-coarse:min-h-tap-coarse"
        >
          {PARTNER_INTERESTS.map((i) => (
            <option key={i.value} value={i.value}>{i.label}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pf-name">Your name</Label>
          <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={100} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pf-org">Company or organisation (optional)</Label>
          <Input id="pf-org" value={organisation} onChange={(e) => setOrganisation(e.target.value)} autoComplete="organization" maxLength={150} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pf-phone">Mobile number</Label>
          <Input id="pf-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required placeholder="10-digit number" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pf-email">Email (optional)</Label>
          <Input id="pf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={150} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pf-message">What do you have in mind?</Label>
        <textarea
          id="pf-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base text-text placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          placeholder="For example: our company has a CSR budget and would like to support elders in Kerala."
        />
      </div>

      {/* Hidden from people; a script that fills it in is ignored. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="pf-company-url">Leave this empty</label>
        <input id="pf-company-url" tabIndex={-1} autoComplete="off" value={companyUrl} onChange={(e) => setCompanyUrl(e.target.value)} />
      </div>

      {error && <p className="text-sm text-danger-600">{error}</p>}
      <Button type="submit" size="lg" disabled={busy}>{busy ? 'Sending…' : 'Send'}</Button>
      <p className="text-xs text-text-secondary">
        We use your details only to reply to this message. See our <a href="/privacy" className="underline">privacy policy</a>.
      </p>
    </form>
  );
}
