'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Camera,
  Video,
  Siren,
  Flame,
  KeyRound,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SafetyFeature {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

/**
 * A placeholder for the Home Safety & Security vision discussed earlier — every item
 * here needs a hardware/device-vendor partnership before any real build can start
 * (see the ec-platform skill's Phase G / Pending Vendor Decisions section), so this
 * page states that plainly rather than a fake "0 devices connected" dashboard that
 * would suggest something's already wired up when nothing is.
 */
const SAFETY_FEATURES: SafetyFeature[] = [
  {
    key: 'cctv',
    label: 'Camera feeds',
    description: 'View live camera feeds from home security cameras, right in the app.',
    icon: Camera,
  },
  {
    key: 'video-chat',
    label: 'Video chat with security',
    description: 'Talk face-to-face with your building’s security desk or a caregiver.',
    icon: Video,
  },
  {
    key: 'fall-sensors',
    label: 'Fall detection sensors',
    description: 'Automatic alerts to family if a fall is detected at home.',
    icon: Siren,
  },
  {
    key: 'kitchen-sensors',
    label: 'Kitchen & gas safety sensors',
    description: 'Warnings for a gas leak or a stove left on.',
    icon: Flame,
  },
  {
    key: 'smart-access',
    label: 'Smart access devices',
    description: 'Smart locks and entry systems you can manage from the app.',
    icon: KeyRound,
  },
];

export default function HomeSafetyPage() {
  return (
    <div>
      <Link href="/services" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600">
        <ArrowLeft className="h-4 w-4" />
        Services
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-text">Home Safety & Security</h1>
      <p className="mt-1 text-text-secondary">
        Camera feeds, video chat, fall and gas sensors, and smart access devices — all in one place. We&rsquo;re
        working on bringing these in through trusted hardware partners; here&rsquo;s what&rsquo;s planned.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {SAFETY_FEATURES.map(({ key, label, description, icon: Icon }) => (
          <Card key={key}>
            <CardContent className="flex items-start gap-4 pt-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
                <Icon className="h-6 w-6 text-primary-600" />
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-text">{label}</p>
                  <Badge variant="muted">Coming soon</Badge>
                </div>
                <p className="mt-1 text-sm text-text-secondary">{description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
