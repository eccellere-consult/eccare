import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, HeartHandshake, Users, Home } from 'lucide-react';
import { PartnerForm } from './partner-form';

export const metadata: Metadata = {
  title: 'Partner with EC',
  description: 'Support free EC access for elders and future offline care services: CSR funding, sponsorship and community partnerships.',
};

/** Public page (no sign-in): where a company or person who wants to support EC says so. No money
 *  is collected here and nothing about tax treatment is promised; the team follows up directly. */
export default function PartnerPage() {
  return (
    <div className="min-h-screen bg-background">
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

      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600">
          <ArrowLeft className="h-4 w-4" /> Back to EC
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-text">Partner with EC</h1>
        <p className="mt-2 text-lg text-text-secondary">
          EC makes daily life easier and safer for elders, and gives their families peace of mind. Elders&rsquo; own accounts are always free.
          Help us reach more of them.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Idea icon={<HeartHandshake className="h-6 w-6 text-primary-600" />} title="Free access for elders" text="Fund the cost of EC for elders and communities who cannot easily afford support." />
          <Idea icon={<Users className="h-6 w-6 text-primary-600" />} title="Community programmes" text="Back events, helplines and neighbour-to-neighbour support in a residents' community." />
          <Idea icon={<Home className="h-6 w-6 text-primary-600" />} title="Offline care services" text="We plan to add in-person support such as check-in visits and help at home. Tell us if you want to help shape it." />
        </div>

        <div className="mt-10 rounded-xl border border-border bg-surface p-6">
          <h2 className="text-xl font-bold text-text">Tell us what you have in mind</h2>
          <p className="mt-1 text-text-secondary">
            This form does not take any payment. We will contact you to talk it through, including who would receive any
            support and how it would be set up.
          </p>
          <PartnerForm />
        </div>
      </main>
    </div>
  );
}

function Idea({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-50">{icon}</div>
      <h2 className="mt-3 font-bold text-text">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-text-secondary">{text}</p>
    </div>
  );
}
