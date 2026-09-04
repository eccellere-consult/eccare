'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { isValidEmail, isValidPhone, EMAIL_FORMAT_MESSAGE, PHONE_FORMAT_MESSAGE } from '@/lib/validation';
import { HelpGuidesSection } from '@/components/help-guides-section';
import { TourButton } from '@/components/tour/TourButton';
import { DedicationFooter } from '@/components/dedication-footer';

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
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/login', { identifier, password, rememberMe });
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
        <Label htmlFor="identifier">Phone number or email</Label>
        <Input
          id="identifier"
          type="text"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="9876543210"
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-sm font-semibold text-primary-600 hover:underline">
            Forgot password?
          </Link>
        </div>
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

const ROLE_TOGGLE_OPTIONS = [
  { value: 'elder', label: 'An elder' },
  { value: 'caregiver', label: 'A family member' },
  { value: 'provider', label: 'A service provider' },
] as const;

const VOLUNTEER_AVAILABILITY_OPTIONS = [
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'always', label: '24/7' },
] as const;
const VOLUNTEER_ASSISTANCE_OPTIONS = [
  { value: 'medical_runs', label: 'Medical Runs' },
  { value: 'companionship', label: 'Companionship' },
  { value: 'errands', label: 'Errands' },
  { value: 'tech_support', label: 'Tech Support' },
] as const;
type VolunteerAvailability = (typeof VOLUNTEER_AVAILABILITY_OPTIONS)[number]['value'];
type AssistanceType = (typeof VOLUNTEER_ASSISTANCE_OPTIONS)[number]['value'];

function CreateAccountForm({ onSuccess }: { onSuccess: (role: string) => void }) {
  const [role, setRole] = useState<'elder' | 'caregiver' | 'provider'>('elder');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [isVolunteer, setIsVolunteer] = useState(false);
  const [availability, setAvailability] = useState<VolunteerAvailability | ''>('');
  const [assistanceTypes, setAssistanceTypes] = useState<AssistanceType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleAssistanceType(type: AssistanceType) {
    setAssistanceTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!phone.trim()) {
      setError('Please enter your phone number.');
      return;
    }
    if (!isValidPhone(phone)) {
      setError(PHONE_FORMAT_MESSAGE);
      return;
    }
    if (email.trim() && !isValidEmail(email)) {
      setError(EMAIL_FORMAT_MESSAGE);
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (role === 'provider' && (!businessName.trim() || !category.trim())) {
      setError('Please enter your business name and category.');
      return;
    }
    if (role === 'caregiver' && isVolunteer && (!availability || assistanceTypes.length === 0)) {
      setError('Please select your availability and at least one way you can help.');
      return;
    }
    setLoading(true);
    try {
      const data = await api('/auth/register', {
        name,
        phone: phone.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        password,
        role,
        ...(role === 'provider' ? { businessName, category } : {}),
        ...(role === 'caregiver' && isVolunteer
          ? { isVolunteer: true, volunteerAvailability: availability, volunteerAssistanceTypes: assistanceTypes }
          : {}),
      });
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
          {ROLE_TOGGLE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRole(value)}
              className={cn(
                'flex-1 rounded-lg py-2 text-xs font-semibold transition-colors sm:text-sm',
                role === value ? 'bg-surface text-primary-900 shadow-sm' : 'text-primary-900/70',
              )}
            >
              {label}
            </button>
          ))}
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
        <Label htmlFor="reg-phone">Phone number</Label>
        <Input
          id="reg-phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="9876543210"
        />
        <p className="text-xs text-text-secondary">
          This is how you'll sign in, and lets neighbours and family reach you directly.
          Whether it's shown in your community's neighbours directory is a separate,
          optional choice you make later.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reg-email">Email (optional)</Label>
        <Input
          id="reg-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <p className="text-xs text-text-secondary">
          Not required, but handy for password-recovery links and if you'd rather sign in with email.
        </p>
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
      {role === 'caregiver' && (
        <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-text">
            <input
              type="checkbox"
              checked={isVolunteer}
              onChange={(e) => setIsVolunteer(e.target.checked)}
              className="h-5 w-5 rounded border-border pointer-coarse:h-6 pointer-coarse:w-6"
            />
            Register as a Community Volunteer
          </label>
          <p className="text-xs text-text-secondary">
            Offer to help elders near you — a committee/admin reviews and verifies volunteers before
            they're shown in the community directory.
          </p>

          {isVolunteer && (
            <div className="mt-2 flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label>Availability</Label>
                <div className="flex flex-wrap gap-2">
                  {VOLUNTEER_AVAILABILITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAvailability(opt.value)}
                      className={cn(
                        'rounded-xl border px-3 py-1.5 text-xs font-semibold',
                        availability === opt.value ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>How can you help? (select all that apply)</Label>
                <div className="flex flex-wrap gap-2">
                  {VOLUNTEER_ASSISTANCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleAssistanceType(opt.value)}
                      className={cn(
                        'rounded-xl border px-3 py-1.5 text-xs font-semibold',
                        assistanceTypes.includes(opt.value) ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {role === 'provider' && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reg-business-name">Business name</Label>
            <Input
              id="reg-business-name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="City Care Clinic"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reg-category">Category</Label>
            <Input
              id="reg-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Nursing, physiotherapy, home care…"
            />
          </div>
        </>
      )}
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
            {view === 'register' && (
              <div className="mb-4 flex justify-center">
                <TourButton tourId="register" />
              </div>
            )}
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

        {view === 'register' && <HelpGuidesSection />}
        <DedicationFooter />
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
