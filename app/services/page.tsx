'use client';

import Link from 'next/link';
import {
  UtensilsCrossed,
  ShoppingBasket,
  Sparkles,
  Truck,
  Car,
  ShoppingBag,
  ExternalLink,
  HeartHandshake,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

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
];

export default function ServicesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Quick services</h1>
      <p className="mt-1 text-text-secondary">
        Jump straight to a trusted service. Opens in a new tab — you&rsquo;ll pick your address and
        finish the order there.
      </p>

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
