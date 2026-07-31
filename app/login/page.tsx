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

function SignInForm({ onSuccess }: { onSuccess: (role: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/login', { email, password, rememberMe });
      onSuccess(data.user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    // A real <form onSubmit> (not just an onClick handler) is what lets browsers'
    // native password managers detect this as a login and offer to save it.
    <form onSubmit={login} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="h-5 w-5 rounded border-border pointer-coarse:h-6 pointer-coarse:w-6"
        />
        Remember me on this device
      </label>
      {error && <p className="text-sm text-danger-600">{error}</p>}
      <Button type="submit" disabled={loading} size="lg">
        {loading ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  );
}

function CreateAccountForm({ onSuccess }: { onSuccess: (role: string) => void }) {
  const [role, setRole] = useState<'elder' | 'caregiver'>('elder');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const data = await api('/auth/register', { name, email, password, role });
      onSuccess(data.user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={register} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>I am</Label>
        <div className="flex h-12 items-center rounded-xl bg-primary-50 p-1">
          <button
            type="button"
            onClick={() => setRole('elder')}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-semibold transition-colors',
              role === 'elder' ? 'bg-surface text-primary-900 shadow-sm' : 'text-primary-900/70',
            )}
          >
            An elder
          </button>
          <button
            type="button"
            onClick={() => setRole('caregiver')}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-semibold transition-colors',
              role === 'caregiver' ? 'bg-surface text-primary-900 shadow-sm' : 'text-primary-900/70',
            )}
          >
            A family member
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reg-name">Full name</Label>
        <Input
          id="reg-name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reg-email">Email</Label>
        <Input
          id="reg-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reg-password">Password</Label>
        <Input
          id="reg-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
      </div>
      {error && <p className="text-sm text-danger-600">{error}</p>}
      <Button type="submit" disabled={loading} size="lg">
        {loading ? 'Creating account...' : 'Create account'}
      </Button>
    </form>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const params = useSearchParams();

  const [view, setView] = useState<'signin' | 'register'>('signin');

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
            <CardTitle>{view === 'signin' ? 'Sign in' : 'Create your account'}</CardTitle>
            <CardDescription>
              {view === 'signin' ? 'Welcome back.' : 'For elders and family members. Takes a minute.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {view === 'signin' ? <SignInForm onSuccess={handleSuccess} /> : <CreateAccountForm onSuccess={handleSuccess} />}

            <button
              type="button"
              onClick={() => setView(view === 'signin' ? 'register' : 'signin')}
              className="mt-6 w-full text-center text-sm font-semibold text-primary-600 hover:underline"
            >
              {view === 'signin' ? "New here? Create an account" : 'Already have an account? Sign in'}
            </button>
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
