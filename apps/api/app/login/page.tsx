'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const ROLE_HOME: Record<string, string> = {
  elder: '/elder',
  caregiver: '/family',
  admin: '/admin',
  provider: '/provider',
};

async function api(path: string, body: unknown) {
  const res = await fetch(`/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || 'Something went wrong. Please try again.');
  }
  return json.data;
}

function OtpLogin({ onSuccess }: { onSuccess: (role: string) => void }) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function sendOtp() {
    setError('');
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    setLoading(true);
    try {
      await api('/auth/send-otp', { phone: `+91${phone}` });
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send OTP.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/verify-otp', { phone: `+91${phone}`, otp });
      onSuccess(data.user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect OTP.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {step === 'phone' ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Phone number</Label>
            <div className="flex gap-2">
              <span className="flex h-11 items-center rounded-xl bg-primary-50 px-3 font-semibold text-primary-900">
                +91
              </span>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                inputMode="numeric"
                maxLength={10}
              />
            </div>
          </div>
          {error && <p className="text-sm text-danger-600">{error}</p>}
          <Button onClick={sendOtp} disabled={loading} size="lg">
            {loading ? 'Sending...' : 'Send OTP'}
          </Button>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="otp">Enter the code sent to +91 {phone}</Label>
            <Input
              id="otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="123456"
              inputMode="numeric"
              maxLength={6}
            />
          </div>
          {error && <p className="text-sm text-danger-600">{error}</p>}
          <Button onClick={verifyOtp} disabled={loading} size="lg">
            {loading ? 'Verifying...' : 'Verify'}
          </Button>
          <Button variant="link" onClick={() => { setStep('phone'); setOtp(''); setError(''); }}>
            Change phone number
          </Button>
        </>
      )}
    </div>
  );
}

function PasswordLogin({ onSuccess }: { onSuccess: (role: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function login() {
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/login', { email, password });
      onSuccess(data.user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="text-sm text-danger-600">{error}</p>}
      <Button onClick={login} disabled={loading} size="lg">
        {loading ? 'Signing in...' : 'Sign in'}
      </Button>
    </div>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const params = useSearchParams();

  const [mode, setMode] = useState<'phone' | 'password'>('phone');

  function handleSuccess(role: string) {
    const next = params.get('next');
    router.push(next || ROLE_HOME[role] || '/login');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-4xl font-black text-primary-600">EC</h1>
          <p className="mt-1 text-text-secondary">Just Easy.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Choose how you'd like to sign in.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex h-12 items-center rounded-xl bg-primary-50 p-1">
              <button
                type="button"
                onClick={() => setMode('phone')}
                className={cn(
                  'flex-1 rounded-lg py-2 text-sm font-semibold transition-colors',
                  mode === 'phone' ? 'bg-surface text-primary-900 shadow-sm' : 'text-primary-900/70',
                )}
              >
                Elder / Family
              </button>
              <button
                type="button"
                onClick={() => setMode('password')}
                className={cn(
                  'flex-1 rounded-lg py-2 text-sm font-semibold transition-colors',
                  mode === 'password' ? 'bg-surface text-primary-900 shadow-sm' : 'text-primary-900/70',
                )}
              >
                Admin / Provider
              </button>
            </div>
            {mode === 'phone' ? <OtpLogin onSuccess={handleSuccess} /> : <PasswordLogin onSuccess={handleSuccess} />}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}
