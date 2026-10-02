'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  isValidEmail,
  isValidAnyPhone,
  isInternationalPhone,
  EMAIL_FORMAT_MESSAGE,
  PHONE_FORMAT_MESSAGE,
  ANY_PHONE_FORMAT_MESSAGE,
  INTERNATIONAL_ROLE_MESSAGE,
} from '@/lib/validation';
import { PhoneField } from '@/components/phone-field';
import { HelpGuidesSection } from '@/components/help-guides-section';
import { TourButton } from '@/components/tour/TourButton';
import { DedicationFooter } from '@/components/dedication-footer';
import { PROVIDER_CATEGORIES } from '@/lib/provider-categories';
import { ShareLocationButton } from '@/components/share-location-button';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/languages';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

const LOGIN_LANGUAGE_STORAGE_KEY = 'ec-login-language';

/** No account (and thus no stored `language`) exists yet on this screen, so it
 *  can't use the elder LanguageProvider (lib/i18n/language-context.tsx), which
 *  is seeded from a server-loaded user. This is a standalone, localStorage-
 *  backed pick instead — best-effort, same defensive try/catch-and-ignore
 *  style already used elsewhere in this app for browser-only reads. */
function useLoginLanguage() {
  const [uiLanguage, setUiLanguageState] = useState('en');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOGIN_LANGUAGE_STORAGE_KEY);
      if (stored) setUiLanguageState(stored);
    } catch {
      // Private browsing / blocked storage — just stay on English.
    }
  }, []);

  function setUiLanguage(lang: string) {
    setUiLanguageState(lang);
    try {
      localStorage.setItem(LOGIN_LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Best-effort — the pick still applies for this page view either way.
    }
  }

  return [uiLanguage, setUiLanguage] as const;
}

const ROLE_HOME: Record<string, string> = {
  elder: '/elder',
  caregiver: '/family',
  admin: '/admin',
  provider: '/provider',
};

async function api(path: string, body: unknown, t: (k: TranslationKey) => string) {
  const res = await fetch(`/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || t('login.errors.genericError'));
  }
  return json.data;
}

function SignInForm({ onSuccess, t }: { onSuccess: (role: string) => void; t: (k: TranslationKey) => string }) {
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
      const data = await api('/auth/login', { identifier, password, rememberMe }, t);
      onSuccess(data.user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.signIn.failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    // A real <form onSubmit> (not just an onClick handler) is what lets browsers'
    // native password managers detect this as a login and offer to save it.
    <form onSubmit={login} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="identifier">{t('login.signIn.identifier')}</Label>
        <Input
          id="identifier"
          type="text"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={t('login.signIn.identifierPlaceholder')}
        />
        <p className="text-xs text-text-secondary">{t('login.signIn.intlHint')}</p>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t('login.signIn.password')}</Label>
          <Link href="/forgot-password" className="text-sm font-semibold text-primary-600 hover:underline">
            {t('login.signIn.forgotPassword')}
          </Link>
        </div>
        <PasswordInput
          id="password"
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
        {t('login.signIn.rememberMe')}
      </label>
      {error && <p className="text-sm text-danger-600">{error}</p>}
      <Button type="submit" disabled={loading} size="lg">
        {loading ? t('login.signIn.signingIn') : t('login.signIn.signIn')}
      </Button>
    </form>
  );
}

const OTP_LISTEN_SECONDS = 30;
const OTP_RESEND_SECONDS = 30;

/** Sign in with a code sent to WhatsApp. Built to need as few taps as a
 *  browser allows: the message WhatsApp delivers has a "Copy code" button, and
 *  for OTP_LISTEN_SECONDS after sending this watches the clipboard — copy the
 *  code, switch back, and it fills in and signs in on its own. The person can
 *  stop that at any time, or just type/paste the code (it also submits itself
 *  at the sixth digit).
 *
 *  A browser can't read a WhatsApp message directly (the WebOTP API only sees
 *  SMS), so "Copy code" in WhatsApp is the one tap this can't remove. */
function OtpSignInForm({ onSuccess, t }: { onSuccess: (role: string) => void; t: (k: TranslationKey) => string }) {
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listenLeft, setListenLeft] = useState(0);
  const [resendLeft, setResendLeft] = useState(0);
  const lastTriedRef = useRef('');
  const verifyingRef = useRef(false);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError('');
    if (!isValidAnyPhone(phone)) {
      setError(ANY_PHONE_FORMAT_MESSAGE);
      return;
    }
    setBusy(true);
    try {
      await api('/auth/send-otp', { phone: phone.trim() }, t);
      setCode('');
      lastTriedRef.current = '';
      setStep('code');
      setListenLeft(OTP_LISTEN_SECONDS);
      setResendLeft(OTP_RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.errors.genericError'));
    } finally {
      setBusy(false);
    }
  }

  async function verify(value: string) {
    if (verifyingRef.current || value.length !== 6) return;
    verifyingRef.current = true;
    lastTriedRef.current = value;
    setError('');
    setBusy(true);
    setListenLeft(0);
    try {
      const data = await api('/auth/verify-otp', { phone: phone.trim(), otp: value, rememberMe: true }, t);
      onSuccess(data.user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.otp.failed'));
      setCode('');
    } finally {
      verifyingRef.current = false;
      setBusy(false);
    }
  }

  // One-second tick for the auto-fill window and the resend cooldown.
  useEffect(() => {
    if (step !== 'code') return;
    const timer = setInterval(() => {
      setListenLeft((s) => Math.max(0, s - 1));
      setResendLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  // Clipboard watch — only while the 30-second window is open. Reads the
  // clipboard only to look for a 6-digit code and discards anything else; stops
  // for good if the browser denies clipboard access.
  const listening = step === 'code' && listenLeft > 0 && !busy;
  useEffect(() => {
    if (!listening || typeof navigator === 'undefined' || !navigator.clipboard?.readText) return;
    let denied = false;
    async function check() {
      if (denied || document.visibilityState !== 'visible' || !document.hasFocus()) return;
      try {
        const text = await navigator.clipboard.readText();
        const match = text.match(/(?<!\d)\d{6}(?!\d)/);
        if (match && match[0] !== lastTriedRef.current) {
          setCode(match[0]);
          verify(match[0]);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'NotAllowedError') denied = true;
      }
    }
    check();
    const poll = setInterval(check, 1000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  if (step === 'phone') {
    return (
      <form onSubmit={sendCode} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="otp-phone">{t('login.otp.phone')}</Label>
          <PhoneField
            id="otp-phone"
            value={phone}
            onChange={setPhone}
            allowInternational
            placeholder={t('login.signIn.identifierPlaceholder')}
            countryLabel={t('login.phone.country')}
            otherLabel={t('login.phone.other')}
          />
        </div>
        {error && <p className="text-sm text-danger-600">{error}</p>}
        <Button type="submit" disabled={busy} size="lg">
          {busy ? t('login.otp.sending') : t('login.otp.sendCode')}
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        verify(code);
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-sm text-text-secondary">{t('login.otp.sentTo').replace('{phone}', phone.trim())}</p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="otp-code">{t('login.otp.codeLabel')}</Label>
        <Input
          id="otp-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          value={code}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
            setCode(digits);
            if (digits.length === 6) verify(digits);
          }}
          className="text-center text-2xl tracking-[0.5em]"
          placeholder="••••••"
        />
      </div>
      {listening && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-primary-50 p-3 text-sm text-primary-900">
          <span>{t('login.otp.listening').replace('{seconds}', String(listenLeft))}</span>
          <button
            type="button"
            onClick={() => setListenLeft(0)}
            className="shrink-0 font-semibold text-primary-600 hover:underline"
          >
            {t('login.otp.stopListening')}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-danger-600">{error}</p>}
      <Button type="submit" disabled={busy || code.length !== 6} size="lg">
        {busy ? t('login.otp.verifying') : t('login.otp.verify')}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          disabled={resendLeft > 0 || busy}
          onClick={() => sendCode()}
          className="font-semibold text-primary-600 hover:underline disabled:text-text-secondary disabled:no-underline"
        >
          {resendLeft > 0 ? t('login.otp.resendIn').replace('{seconds}', String(resendLeft)) : t('login.otp.resend')}
        </button>
        <button
          type="button"
          onClick={() => {
            setStep('phone');
            setError('');
            setListenLeft(0);
          }}
          className="font-semibold text-text-secondary hover:underline"
        >
          {t('login.otp.changeNumber')}
        </button>
      </div>
    </form>
  );
}

const ROLE_TOGGLE_OPTIONS = [
  { value: 'elder', labelKey: 'login.role.elder' },
  { value: 'caregiver', labelKey: 'login.role.caregiver' },
  { value: 'provider', labelKey: 'login.role.provider' },
] as const satisfies readonly { value: string; labelKey: TranslationKey }[];

const VOLUNTEER_AVAILABILITY_OPTIONS = [
  { value: 'weekdays', labelKey: 'login.availability.weekdays' },
  { value: 'weekends', labelKey: 'login.availability.weekends' },
  { value: 'always', labelKey: 'login.availability.always' },
] as const satisfies readonly { value: string; labelKey: TranslationKey }[];
const VOLUNTEER_ASSISTANCE_OPTIONS = [
  { value: 'medical_runs', labelKey: 'login.assistance.medicalRuns' },
  { value: 'companionship', labelKey: 'login.assistance.companionship' },
  { value: 'errands', labelKey: 'login.assistance.errands' },
  { value: 'tech_support', labelKey: 'login.assistance.techSupport' },
] as const satisfies readonly { value: string; labelKey: TranslationKey }[];
type VolunteerAvailability = (typeof VOLUNTEER_AVAILABILITY_OPTIONS)[number]['value'];
type AssistanceType = (typeof VOLUNTEER_ASSISTANCE_OPTIONS)[number]['value'];

function CreateAccountForm({
  onSuccess,
  t,
  uiLanguage,
}: {
  onSuccess: (role: string) => void;
  t: (k: TranslationKey) => string;
  uiLanguage: string;
}) {
  const [role, setRole] = useState<'elder' | 'caregiver' | 'provider'>('elder');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [otherCategory, setOtherCategory] = useState('');
  const [backupContactName, setBackupContactName] = useState('');
  const [backupContactPhone, setBackupContactPhone] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [isVolunteer, setIsVolunteer] = useState(false);
  const [availability, setAvailability] = useState<VolunteerAvailability | ''>('');
  const [assistanceTypes, setAssistanceTypes] = useState<AssistanceType[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [prices, setPrices] = useState<{ familyMonthlyPrice: number; familyAnnualPrice: number; trialDays: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/v1/pricing')
      .then((r) => r.json())
      .then((j) => { if (j.success) setPrices(j.data); })
      .catch(() => {});
  }, []);

  function toggleAssistanceType(type: AssistanceType) {
    setAssistanceTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!phone.trim()) {
      setError(t('login.errors.enterPhone'));
      return;
    }
    if (!isValidAnyPhone(phone)) {
      setError(role === 'caregiver' ? ANY_PHONE_FORMAT_MESSAGE : PHONE_FORMAT_MESSAGE);
      return;
    }
    if (isInternationalPhone(phone) && role !== 'caregiver') {
      setError(INTERNATIONAL_ROLE_MESSAGE);
      return;
    }
    if (email.trim() && !isValidEmail(email)) {
      setError(EMAIL_FORMAT_MESSAGE);
      return;
    }
    if (password.length < 8) {
      setError(t('login.errors.passwordTooShort'));
      return;
    }
    const resolvedCategory = category === 'other' ? otherCategory.trim() : category;
    if (role === 'provider' && (!businessName.trim() || !resolvedCategory)) {
      setError(t('login.errors.businessNameCategoryRequired'));
      return;
    }
    if (role === 'caregiver' && isVolunteer && (!availability || assistanceTypes.length === 0)) {
      setError(t('login.errors.selectAvailabilityAndHelp'));
      return;
    }
    setLoading(true);
    try {
      const data = await api(
        '/auth/register',
        {
          name,
          phone: phone.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          password,
          role,
          ...(role === 'provider'
            ? {
                businessName,
                category: resolvedCategory,
                ...(backupContactName.trim() ? { backupContactName: backupContactName.trim() } : {}),
                ...(backupContactPhone.trim() ? { backupContactPhone: backupContactPhone.trim() } : {}),
                ...(lat && lng ? { lat: Number(lat), lng: Number(lng) } : {}),
              }
            : {}),
          ...(role === 'caregiver' && isVolunteer
            ? { isVolunteer: true, volunteerAvailability: availability, volunteerAssistanceTypes: assistanceTypes }
            : {}),
          ...(role === 'caregiver' ? { billingCycle } : {}),
          // The page-level language switcher doubles as the elder's language
          // picker — no separate control needed. Meaningless for other roles
          // (their portals aren't translated), so only sent for elder.
          ...(role === 'elder' ? { language: uiLanguage } : {}),
        },
        t,
      );
      onSuccess(data.user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.errors.couldNotCreateAccount'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={register} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>{t('login.role.iAm')}</Label>
        <div className="flex h-12 items-center rounded-xl bg-primary-50 p-1">
          {ROLE_TOGGLE_OPTIONS.map(({ value, labelKey }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRole(value)}
              className={cn(
                'flex-1 rounded-lg py-2 text-xs font-semibold transition-colors sm:text-sm',
                role === value ? 'bg-surface text-primary-900 shadow-sm' : 'text-primary-900/70',
              )}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reg-name">{t('login.register.fullName')}</Label>
        <Input
          id="reg-name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('login.register.fullNamePlaceholder')}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reg-phone">{t('login.register.phoneNumber')}</Label>
        <PhoneField
          id="reg-phone"
          value={phone}
          onChange={setPhone}
          allowInternational={role === 'caregiver'}
          placeholder={t('login.register.phoneNumberPlaceholder')}
          countryLabel={t('login.phone.country')}
          otherLabel={t('login.phone.other')}
          helper={role === 'caregiver' ? t('login.phone.intlHelper') : t('login.register.phoneHelper')}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reg-email">{t('login.register.emailOptional')}</Label>
        <Input
          id="reg-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('login.register.emailPlaceholder')}
        />
        <p className="text-xs text-text-secondary">{t('login.register.emailHelper')}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reg-password">{t('login.register.password')}</Label>
        <PasswordInput
          id="reg-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('login.register.passwordPlaceholder')}
        />
      </div>
      {role === 'caregiver' && prices && (
        <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <Label>{t('login.familyPlan.title')}</Label>
          <p className="text-xs text-text-secondary">
            {t('login.familyPlan.helper').replace('{trialDays}', String(prices.trialDays))}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={cn(
                'flex-1 rounded-xl border px-3 py-2 text-sm font-semibold',
                billingCycle === 'monthly' ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary',
              )}
            >
              {t('login.familyPlan.perMonth').replace('{amount}', String(prices.familyMonthlyPrice))}
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={cn(
                'flex-1 rounded-xl border px-3 py-2 text-sm font-semibold',
                billingCycle === 'annual' ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary',
              )}
            >
              {t('login.familyPlan.perYear').replace('{amount}', String(prices.familyAnnualPrice))}
            </button>
          </div>
        </div>
      )}
      {role === 'caregiver' && (
        <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-text">
            <input
              type="checkbox"
              checked={isVolunteer}
              onChange={(e) => setIsVolunteer(e.target.checked)}
              className="h-5 w-5 rounded border-border pointer-coarse:h-6 pointer-coarse:w-6"
            />
            {t('login.volunteer.registerAs')}
          </label>
          <p className="text-xs text-text-secondary">{t('login.volunteer.helper')}</p>

          {isVolunteer && (
            <div className="mt-2 flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label>{t('login.volunteer.availability')}</Label>
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
                      {t(opt.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t('login.volunteer.howCanYouHelp')}</Label>
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
                      {t(opt.labelKey)}
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
            <Label htmlFor="reg-business-name">{t('login.provider.businessName')}</Label>
            <Input
              id="reg-business-name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={t('login.provider.businessNamePlaceholder')}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reg-category">{t('login.provider.category')}</Label>
            <select
              id="reg-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            >
              <option value="">{t('login.provider.selectCategory')}</option>
              {PROVIDER_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          {category === 'other' && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-category-other">{t('login.provider.tellUsCategory')}</Label>
              <Input
                id="reg-category-other"
                value={otherCategory}
                onChange={(e) => setOtherCategory(e.target.value)}
                placeholder={t('login.provider.categoryPlaceholder')}
              />
            </div>
          )}
          {/* Backup contact + geolocation — both optional, skippable here and
              fillable later via the provider's own profile page. */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="reg-backup-name">{t('login.provider.backupContactName')}</Label>
            <Input
              id="reg-backup-name"
              value={backupContactName}
              onChange={(e) => setBackupContactName(e.target.value)}
              placeholder={t('login.provider.backupContactNamePlaceholder')}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reg-backup-phone">{t('login.provider.backupContactPhone')}</Label>
            <Input
              id="reg-backup-phone"
              type="tel"
              value={backupContactPhone}
              onChange={(e) => setBackupContactPhone(e.target.value)}
              placeholder={t('login.provider.backupContactPhonePlaceholder')}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t('login.provider.businessLocation')}</Label>
            <ShareLocationButton lat={lat} onLocated={(newLat, newLng) => { setLat(newLat); setLng(newLng); }} onError={setError} />
          </div>
        </>
      )}
      {error && <p className="text-sm text-danger-600">{error}</p>}
      <Button type="submit" disabled={loading} size="lg">
        {loading ? t('login.register.creatingAccount') : t('login.register.createAccount')}
      </Button>
    </form>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [uiLanguage, setUiLanguage] = useLoginLanguage();
  const t = (key: TranslationKey) => translate(key, uiLanguage);

  const [view, setView] = useState<'signin' | 'register'>('signin');
  // The WhatsApp-code option only appears once the server says it's actually
  // set up (see /api/v1/auth/otp-status) — never as a dead end.
  const [otpAvailable, setOtpAvailable] = useState(false);
  const [useOtp, setUseOtp] = useState(true);
  useEffect(() => {
    fetch('/api/v1/auth/otp-status')
      .then((r) => r.json())
      .then((j) => setOtpAvailable(Boolean(j?.data?.available)))
      .catch(() => {});
  }, []);

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
          <p className="mt-1 text-text-secondary">{t('login.tagline')}</p>
        </div>

        <div className="mb-4 flex justify-center gap-1.5" role="group" aria-label={t('login.chooseLanguage')}>
          {SUPPORTED_LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setUiLanguage(l.code)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors pointer-coarse:py-2',
                uiLanguage === l.code
                  ? 'border-primary-600 bg-primary-50 text-primary-900'
                  : 'border-border text-text-secondary hover:border-primary-300',
              )}
            >
              {l.native}
            </button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{view === 'signin' ? t('login.card.signInTitle') : t('login.card.createAccountTitle')}</CardTitle>
            <CardDescription>
              {view === 'signin' ? t('login.card.welcomeBack') : t('login.card.forElders')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {view === 'register' && (
              <div className="mb-4 flex justify-center">
                <TourButton tourId="register" />
              </div>
            )}
            {view === 'signin' ? (
              <>
                {otpAvailable && useOtp ? (
                  <OtpSignInForm onSuccess={handleSuccess} t={t} />
                ) : (
                  <SignInForm onSuccess={handleSuccess} t={t} />
                )}
                {otpAvailable && (
                  <button
                    type="button"
                    onClick={() => setUseOtp((v) => !v)}
                    className="mt-4 w-full text-center text-sm font-semibold text-primary-600 hover:underline"
                  >
                    {useOtp ? t('login.otp.usePassword') : t('login.otp.useCode')}
                  </button>
                )}
              </>
            ) : (
              <CreateAccountForm onSuccess={handleSuccess} t={t} uiLanguage={uiLanguage} />
            )}

            <button
              type="button"
              onClick={() => setView(view === 'signin' ? 'register' : 'signin')}
              className="mt-6 w-full text-center text-sm font-semibold text-primary-600 hover:underline"
            >
              {view === 'signin' ? t('login.newHere') : t('login.alreadyHaveAccount')}
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
