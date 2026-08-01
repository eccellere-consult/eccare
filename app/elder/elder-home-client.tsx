'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Phone, Users, User, Ambulance, FileImage } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const AMBULANCE_NUMBER = '108';

interface Invite {
  id: string;
  relationship: string;
  caregiverUser: { name: string; phone: string | null };
}

interface PrescriptionRef {
  id: string;
  filePath: string;
  doctorName: string | null;
  fileName: string;
  prescriptionDate: string | null;
  createdAt: string;
}

export function ElderHomeClient({ userName, invites }: { userName: string; invites: Invite[] }) {
  const [prescriptions, setPrescriptions] = useState<PrescriptionRef[]>([]);
  useEffect(() => {
    fetch('/api/v1/health/prescriptions', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success && j.data?.length) setPrescriptions(j.data.slice(0, 3)); })
      .catch(() => {});
  }, []);
  const router = useRouter();
  const [pendingInvites, setPendingInvites] = useState(invites);
  const [sosSending, setSosSending] = useState(false);
  const [sosMessage, setSosMessage] = useState('');

  async function respondToInvite(id: string, action: 'accept' | 'decline') {
    await fetch(`/api/v1/family/invites/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setPendingInvites((prev) => prev.filter((i) => i.id !== id));
  }

  function getLocation(): Promise<{ lat?: number; lng?: number }> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({}),
        { timeout: 5000 },
      );
    });
  }

  async function handleSOS() {
    if (!confirm('Send an emergency alert to your family right now?')) return;
    setSosSending(true);
    setSosMessage('');
    try {
      const { lat, lng } = await getLocation();
      const res = await fetch('/api/v1/emergency/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerType: 'manual', lat, lng }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not send alert.');
      setSosMessage('Help is coming. Your family has been notified.');
    } catch (err) {
      setSosMessage(err instanceof Error ? err.message : 'Could not send alert. Please try again.');
    } finally {
      setSosSending(false);
    }
  }

  function handleAmbulance() {
    if (confirm(`Call ambulance now? This will dial ${AMBULANCE_NUMBER}.`)) {
      window.location.href = `tel:${AMBULANCE_NUMBER}`;
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-text">Hello, {userName}</h1>
      <p className="mt-1 text-lg text-text-secondary">What do you need?</p>

      {pendingInvites.length > 0 && (
        <div className="mt-6 flex flex-col gap-3">
          {pendingInvites.map((invite) => (
            <Card key={invite.id} className="border-accent-100 bg-accent-50">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <p className="font-semibold text-accent-900">
                  {invite.caregiverUser.name} wants to connect as your {invite.relationship.toLowerCase()}.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => respondToInvite(invite.id, 'accept')}>
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => respondToInvite(invite.id, 'decline')}>
                    Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link href="/elder/contacts">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 py-8">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-50">
                <Users className="h-7 w-7 text-primary-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-text">Call Family</p>
                <p className="text-sm text-text-secondary">Reach your saved contacts</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/elder/profile">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 py-8">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-50">
                <User className="h-7 w-7 text-primary-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-text">Your Profile</p>
                <p className="text-sm text-text-secondary">Update your details</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card className="mt-6 border-danger-100">
        <CardHeader>
          <CardTitle className="text-danger-900">Emergency</CardTitle>
          <CardDescription>Press the button below if you need help right away.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button variant="danger" size="lg" className="flex-1" onClick={handleSOS} disabled={sosSending}>
            <AlertTriangle className="h-6 w-6" />
            {sosSending ? 'Sending...' : 'Need Help Now'}
          </Button>
          <Button variant="outline" size="lg" className="flex-1 border-danger-600 text-danger-600" onClick={handleAmbulance}>
            <Ambulance className="h-6 w-6" />
            Call Ambulance
          </Button>
        </CardContent>
        {sosMessage && <CardContent className="pt-0 text-sm font-semibold text-text">{sosMessage}</CardContent>}
      </Card>

      {prescriptions.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileImage className="h-5 w-5 text-primary-600" />
              My prescriptions
            </CardTitle>
            <CardDescription>Quick access to your latest prescriptions.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {prescriptions.map((p) => (
              <a
                key={p.id}
                href={p.filePath}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm transition-colors hover:bg-primary-50"
              >
                <span className="font-semibold text-text">{p.doctorName ?? p.fileName}</span>
                <span className="text-xs text-text-secondary">
                  {p.prescriptionDate
                    ? new Date(p.prescriptionDate).toLocaleDateString()
                    : new Date(p.createdAt).toLocaleDateString()}
                </span>
              </a>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
