'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PricingContent {
  isVisible: boolean;
  elderIntro: string;
  elderFeatures: string[];
  familyIntro: string;
  familyFeatures: string[];
  communityIntro: string;
  communityFeatures: string[];
}

type Tab = 'elder' | 'family' | 'community';

const TABS: { id: Tab; label: string }[] = [
  { id: 'elder', label: 'For Elders' },
  { id: 'family', label: 'For Family' },
  { id: 'community', label: 'For Your Community' },
];

/** An honest, informational plans page — every bullet listed here is a real,
 *  shipped feature (curated against the actual codebase, not the full
 *  EC_Care_Pricing_Plan.docx wishlist). Content and the isVisible switch are
 *  admin-editable at /admin/pricing, not hardcoded here. Same
 *  logged-in-awareness as /newsletter: this page is genuinely public, but a
 *  logged-in visitor already has full portal chrome from the layout, so this
 *  page's own header skips the "Sign in" link when a session exists. */
export default function PricingPage() {
  const [content, setContent] = useState<PricingContent | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState<Tab>('elder');

  useEffect(() => {
    fetch('/api/v1/pricing')
      .then((r) => r.json())
      .then((j) => { if (j.success) setContent(j.data); })
      .catch(() => {});
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => setLoggedIn(Boolean(j.success)))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {!loggedIn && (
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
            <Link href="/" className="text-xl font-bold text-primary-600">
              EC <span className="font-normal text-text-secondary">— Just Easy.</span>
            </Link>
            <Link href="/login" className="text-sm font-semibold text-text-secondary hover:text-primary-600">
              Sign in
            </Link>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600">
          <ArrowLeft className="h-4 w-4" /> Back to EC
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-text">Plans</h1>
        <p className="mt-2 text-text-secondary">What's included today — for elders, family, and your community.</p>

        {!content ? (
          <p className="mt-8 text-text-secondary">Loading…</p>
        ) : !content.isVisible ? (
          <p className="mt-8 text-text-secondary">Pricing information isn&rsquo;t available right now.</p>
        ) : (
          <>
            <div className="mt-8 flex flex-col gap-2 sm:flex-row">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    tab === t.id ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-border text-text-secondary hover:border-primary-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-border bg-surface p-6">
              {tab === 'elder' && <PlanPanel intro={content.elderIntro} features={content.elderFeatures} />}
              {tab === 'family' && <PlanPanel intro={content.familyIntro} features={content.familyFeatures} />}
              {tab === 'community' && <PlanPanel intro={content.communityIntro} features={content.communityFeatures} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function PlanPanel({ intro, features }: { intro: string; features: string[] }) {
  return (
    <div>
      <p className="text-text-secondary">{intro}</p>
      <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-text-secondary">
        {features.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>
    </div>
  );
}
