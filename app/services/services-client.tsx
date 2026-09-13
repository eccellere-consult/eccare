'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  UtensilsCrossed,
  ShoppingBasket,
  Sparkles,
  Truck,
  Car,
  ShoppingBag,
  Receipt,
  ShieldCheck,
  ExternalLink,
  HeartHandshake,
  ChevronRight,
  FlaskConical,
  Home as HomeIcon,
  Scale,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Provider {
  name: string;
  url: string;
}

interface ServiceCategory {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  providers: Provider[];
}

interface Identity {
  id: string;
  name: string;
}

/**
 * None of these partners offer a self-serve API, so this is a curated handoff, not a
 * real integration: tapping a provider opens their own site/app in a new tab, where
 * the resident picks their own address and completes the order themselves. We
 * deliberately don't claim to "prefill" address or item details — none of these
 * providers support that through a plain web link, and pretending otherwise would
 * just produce a broken-feeling handoff.
 */
const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    key: 'food',
    label: 'Food delivery',
    description: 'Order a meal from a nearby restaurant',
    icon: UtensilsCrossed,
    providers: [
      { name: 'Swiggy', url: 'https://www.swiggy.com' },
      { name: 'Zomato', url: 'https://www.zomato.com' },
    ],
  },
  {
    key: 'grocery',
    label: 'Groceries',
    description: 'Get groceries delivered to your door',
    icon: ShoppingBasket,
    providers: [
      { name: 'Swiggy Instamart', url: 'https://www.swiggy.com/instamart' },
      { name: 'Blinkit', url: 'https://blinkit.com' },
    ],
  },
  {
    key: 'home',
    label: 'Home services',
    description: 'Cleaning, salon, appliance repair and more',
    icon: Sparkles,
    providers: [{ name: 'Urban Company', url: 'https://www.urbancompany.com' }],
  },
  {
    key: 'courier',
    label: 'Courier & movers',
    description: 'Send a parcel or move goods',
    icon: Truck,
    providers: [{ name: 'Porter', url: 'https://porter.in' }],
  },
  {
    key: 'cabs',
    label: 'Cabs & travel',
    description: 'Book a cab to get around',
    icon: Car,
    providers: [
      { name: 'Ola', url: 'https://book.olacabs.com' },
      { name: 'Uber', url: 'https://m.uber.com' },
    ],
  },
  {
    key: 'shopping',
    label: 'Shopping',
    description: 'Order everyday essentials online',
    icon: ShoppingBag,
    providers: [
      { name: 'Amazon', url: 'https://www.amazon.in' },
      { name: 'Flipkart', url: 'https://www.flipkart.com' },
    ],
  },
  {
    key: 'diagnostics',
    label: 'Diagnose reports',
    description: 'Book lab tests and get diagnostic reports read',
    icon: FlaskConical,
    providers: [{ name: 'HealthSutra', url: 'https://healthsutra.ai' }],
  },
  {
    key: 'bills',
    label: 'Bill payments',
    description: 'Electricity, water, mobile, DTH, and property tax — all in one place',
    icon: Receipt,
    providers: [
      { name: 'Paytm', url: 'https://paytm.com/electricity-bill-payment' },
      { name: 'PhonePe', url: 'https://www.phonepe.com' },
    ],
  },
];

export function ServicesClient({
  role,
  elder,
  self,
}: {
  role: string | null;
  /** null when the caregiver has no accepted elder yet, or the viewer isn't a
   *  caregiver at all — "for myself" becomes the only option rather than a
   *  dead end. */
  elder: Identity | null;
  self: Identity | null;
}) {
  const [actingAs, setActingAs] = useState<'elder' | 'self'>(elder ? 'elder' : 'self');
  const active = actingAs === 'elder' && elder ? elder : self;
  // Elder viewers have nothing to toggle (they ARE "self"); the toggle only
  // ever renders for a caregiver with at least one accepted elder.
  const showToggle = role === 'caregiver' && Boolean(elder);
  const elderParam = role === 'caregiver' && active ? `?elderUserId=${active.id}` : '';

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Quick services</h1>
      <p className="mt-1 text-text-secondary">
        Jump straight to a trusted service. Opens in a new tab — you&rsquo;ll pick your address and
        finish the order there.
      </p>

      {showToggle && elder && self && (
        <div className="mt-4 flex h-12 w-fit min-w-[16rem] items-center rounded-xl bg-primary-50 p-1">
          {([
            ['elder', elder.name],
            ['self', 'For myself'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActingAs(value)}
              className={cn(
                'flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                actingAs === value ? 'bg-surface text-primary-900 shadow-sm' : 'text-primary-900/70',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <Link href="/services/elder-care" className="mt-6 block">
        <Card className="border-accent-100 bg-accent-50 transition-shadow hover:shadow-md">
          <CardContent className="flex items-center gap-4 pt-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface">
              <HeartHandshake className="h-6 w-6 text-accent-600" />
            </span>
            <div className="flex-1">
              <p className="font-bold text-text">Elder Care Services</p>
              <p className="text-sm text-text-secondary">Home treatment, nursing, companion service, and local errands</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-text-secondary" />
          </CardContent>
        </Card>
      </Link>

      <Link href={`/services/advisory${elderParam}`} className="mt-4 block">
        <Card className="border-border bg-surface transition-shadow hover:shadow-md">
          <CardContent className="flex items-center gap-4 pt-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
              <Scale className="h-6 w-6 text-primary-600" />
            </span>
            <div className="flex-1">
              <p className="font-bold text-text">Financial, Legal &amp; Advisory Services</p>
              <p className="text-sm text-text-secondary">Wills, reverse mortgage, senior insurance</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-text-secondary" />
          </CardContent>
        </Card>
      </Link>

      <Link href={`/services/bill-pay${elderParam}`} className="mt-4 block">
        <Card className="border-border bg-surface transition-shadow hover:shadow-md">
          <CardContent className="flex items-center gap-4 pt-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
              <Zap className="h-6 w-6 text-primary-600" />
            </span>
            <div className="flex-1">
              <p className="font-bold text-text">Bill Pay</p>
              <p className="text-sm text-text-secondary">Link utility accounts and pay bills directly</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-text-secondary" />
          </CardContent>
        </Card>
      </Link>

      <Link href={`/services/property-management${elderParam}`} className="mt-4 block">
        <Card className="border-border bg-surface transition-shadow hover:shadow-md">
          <CardContent className="flex items-center gap-4 pt-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
              <Wrench className="h-6 w-6 text-primary-600" />
            </span>
            <div className="flex-1">
              <p className="font-bold text-text">Property Management</p>
              <p className="text-sm text-text-secondary">Periodic home reviews, inspections, and repair estimates</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-text-secondary" />
          </CardContent>
        </Card>
      </Link>

      <Link href="/rentals" className="mt-4 block">
        <Card className="border-border bg-surface transition-shadow hover:shadow-md">
          <CardContent className="flex items-center gap-4 pt-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
              <HomeIcon className="h-6 w-6 text-primary-600" />
            </span>
            <div className="flex-1">
              <p className="font-bold text-text">Senior-Friendly Rentals</p>
              <p className="text-sm text-text-secondary">Houses and rooms with accessibility filters</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-text-secondary" />
          </CardContent>
        </Card>
      </Link>

      {role !== 'elder' && (
        <Link href="/services/safety" className="mt-4 block">
          <Card className="border-border bg-surface transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 pt-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
                <ShieldCheck className="h-6 w-6 text-primary-600" />
              </span>
              <div className="flex-1">
                <p className="font-bold text-text">Home Safety & Security</p>
                <p className="text-sm text-text-secondary">Cameras, video chat, fall & gas sensors, smart access — coming soon</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-text-secondary" />
            </CardContent>
          </Card>
        </Link>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {SERVICE_CATEGORIES.map(({ key, label, description, icon: Icon, providers }) => (
          <Card key={key}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
                  <Icon className="h-6 w-6 text-primary-600" />
                </span>
                <div>
                  <p className="font-bold text-text">{label}</p>
                  <p className="text-sm text-text-secondary">{description}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {providers.map((p) => (
                  <a
                    key={p.name}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text hover:bg-primary-50"
                  >
                    {p.name}
                    <ExternalLink className="h-3.5 w-3.5 text-text-secondary" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
