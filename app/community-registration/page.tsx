'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const APPLICANT_TYPES = ["Residents' Association", 'Panchayat / Local Government Body', 'Housing Society', 'Other'];

/** Public application form for a residents' association, panchayat office, or
 *  other local authority to register a new locality on EC — no login required,
 *  since the typical applicant has never used EC before. On submit, this
 *  creates a pending CommunityApplication for EC admin to review at
 *  /admin/community-applications; approval creates the real community and a
 *  claimable admin account for the applicant (see that route's own comment). */
export default function CommunityRegistrationPage() {
  const [placeName, setPlaceName] = useState('');
  const [applicantType, setApplicantType] = useState(APPLICANT_TYPES[0]);
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locating, setLocating] = useState(false);
  const [numberOfFamilies, setNumberOfFamilies] = useState('');
  const [applicantName, setApplicantName] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [applicantDesignation, setApplicantDesignation] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function shareLocation() {
    if (!navigator.geolocation) {
      setError('Location sharing is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setLocating(false);
      },
      () => {
        setError('Could not get your location — you can still submit without it.');
        setLocating(false);
      },
      { timeout: 8000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!placeName.trim() || !pincode.trim() || !applicantName.trim() || !applicantPhone.trim()) {
      setError('Please fill in the required fields.');
      return;
    }
    if (!proofFile) {
      setError('Please attach proof of authority.');
      return;
    }

    setBusy(true);
    const form = new FormData();
    form.append('placeName', placeName.trim());
    form.append('applicantType', applicantType);
    form.append('city', city.trim());
    form.append('pincode', pincode.trim());
    if (lat) form.append('lat', lat);
    if (lng) form.append('lng', lng);
    if (numberOfFamilies) form.append('numberOfFamilies', numberOfFamilies);
    form.append('applicantName', applicantName.trim());
    form.append('applicantPhone', applicantPhone.trim());
    if (applicantEmail.trim()) form.append('applicantEmail', applicantEmail.trim());
    if (applicantDesignation.trim()) form.append('applicantDesignation', applicantDesignation.trim());
    form.append('proofOfAuthority', proofFile);
    for (const f of additionalFiles) form.append('additionalDocuments', f);

    try {
      const res = await fetch('/api/v1/community-applications', { method: 'POST', body: form });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Could not submit the application.');
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the application.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-xl font-bold text-primary-600">
            EC <span className="font-normal text-text-secondary">— Just Easy.</span>
          </Link>
          <Link href="/login" className="text-sm font-semibold text-text-secondary hover:text-primary-600">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <Link href="/" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600">
          <ArrowLeft className="h-4 w-4" /> Back to EC
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-text">Register your community</h1>
        <p className="mt-2 text-text-secondary">
          For a residents&rsquo; association, panchayat office, or other local authority to bring EC to
          your locality. Submit this once — our team reviews it and allocates a locality code.
        </p>

        {submitted ? (
          <Card className="mt-8">
            <CardContent className="py-10 text-center">
              <p className="font-bold text-text">Application submitted</p>
              <p className="mt-2 text-text-secondary">
                We&rsquo;ll review your details and be in touch on the phone number you provided. Once
                approved, you&rsquo;ll receive your locality code and instructions to set up your account.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-8">
            <CardContent className="pt-6">
              <form onSubmit={submit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="placeName">Name of place / association *</Label>
                  <Input id="placeName" value={placeName} onChange={(e) => setPlaceName(e.target.value)} placeholder="Green Meadows Residents Association" />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="applicantType">Applicant type</Label>
                  <select
                    id="applicantType"
                    value={applicantType}
                    onChange={(e) => setApplicantType(e.target.value)}
                    className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  >
                    {APPLICANT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="city">City / town</Label>
                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="pincode">PIN code *</Label>
                    <Input id="pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Location</Label>
                  <Button type="button" variant="outline" onClick={shareLocation} disabled={locating} className="w-fit">
                    <MapPin className="mr-1.5 h-4 w-4" />
                    {locating ? 'Getting location…' : lat ? 'Location captured' : 'Share current location'}
                  </Button>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="numberOfFamilies">Number of families</Label>
                  <Input id="numberOfFamilies" type="number" min={0} value={numberOfFamilies} onChange={(e) => setNumberOfFamilies(e.target.value)} />
                </div>

                <div className="border-t border-border pt-4">
                  <p className="font-bold text-text">Your details</p>
                  <p className="mt-1 text-sm text-text-secondary">So we can reach you about this application.</p>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="applicantName">Your name *</Label>
                  <Input id="applicantName" value={applicantName} onChange={(e) => setApplicantName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="applicantPhone">Phone number *</Label>
                    <Input id="applicantPhone" value={applicantPhone} onChange={(e) => setApplicantPhone(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="applicantEmail">Email (optional)</Label>
                    <Input id="applicantEmail" type="email" value={applicantEmail} onChange={(e) => setApplicantEmail(e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="applicantDesignation">Your role / designation</Label>
                  <Input id="applicantDesignation" value={applicantDesignation} onChange={(e) => setApplicantDesignation(e.target.value)} placeholder="Secretary, Ward Member, etc." />
                </div>

                <div className="border-t border-border pt-4">
                  <p className="font-bold text-text">Documents</p>
                  <p className="mt-1 text-sm text-text-secondary">PDF, JPEG, or PNG, up to 10 MB each.</p>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="proofOfAuthority">Proof of authority *</Label>
                  <input
                    id="proofOfAuthority"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                    className="text-sm text-text-secondary"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="additionalDocuments">Additional documents (optional)</Label>
                  <input
                    id="additionalDocuments"
                    type="file"
                    multiple
                    accept="application/pdf,image/jpeg,image/png"
                    onChange={(e) => setAdditionalFiles(Array.from(e.target.files ?? []))}
                    className="text-sm text-text-secondary"
                  />
                </div>

                {error && <p className="text-sm text-danger-600">{error}</p>}
                <Button type="submit" size="lg" disabled={busy}>
                  {busy ? 'Submitting…' : 'Submit application'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
