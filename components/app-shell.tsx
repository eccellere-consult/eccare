'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu,
  X,
  LogOut,
  Home,
  Users,
  User,
  LayoutDashboard,
  AlertTriangle,
  UserPlus,
  Kanban,
  Building2,
  Sparkles,
  HeartPulse,
  Briefcase,
  Languages,
  Package,
  PackageCheck,
  Flower2,
  GraduationCap,
  HeartHandshake,
  Camera,
  MessageCircle,
  IndianRupee,
  Settings,
  Mail,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/language-context';
import { languageLabel } from '@/lib/i18n/languages';
import { VoiceAssistant } from '@/components/voice-assistant';
import { ReminderAlerts } from '@/components/reminder-alerts';

export type PortalRole = 'elder' | 'family' | 'admin' | 'provider';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV_CONFIG: Record<PortalRole, { label: string; items: NavItem[] }> = {
  elder: {
    label: 'Golden Generation',
    items: [
      { label: 'Home', href: '/elder', icon: Home },
      { label: 'Contacts', href: '/elder/contacts', icon: Users },
      { label: 'Health', href: '/elder/health', icon: HeartPulse },
      { label: 'Community', href: '/community', icon: Building2 },
      { label: 'Services', href: '/services', icon: Sparkles },
      { label: 'Orders', href: '/elder/orders', icon: PackageCheck },
      { label: 'Payments', href: '/elder/payments', icon: IndianRupee },
      { label: 'Memories', href: '/elder/memories', icon: Camera },
      { label: 'Profile', href: '/elder/profile', icon: User },
    ],
  },
  family: {
    label: 'Family',
    items: [
      { label: 'Dashboard', href: '/family', icon: LayoutDashboard },
      { label: 'Health', href: '/family/health', icon: HeartPulse },
      { label: 'Contacts', href: '/family/contacts', icon: Users },
      { label: 'Community', href: '/community', icon: Building2 },
      { label: 'Services', href: '/services', icon: Sparkles },
      { label: 'Orders', href: '/family/orders', icon: PackageCheck },
      { label: 'Payments', href: '/family/payments', icon: IndianRupee },
      { label: 'Memories', href: '/family/memories', icon: Camera },
      { label: 'SOS History', href: '/family/sos-history', icon: AlertTriangle },
      { label: 'Invite Elder', href: '/family/invite', icon: UserPlus },
      { label: 'Profile', href: '/family/profile', icon: User },
    ],
  },
  admin: {
    label: 'Admin',
    items: [
      { label: 'Overview', href: '/admin', icon: LayoutDashboard },
      { label: 'Users', href: '/admin/users', icon: Users },
      { label: 'Communities', href: '/admin/communities', icon: Building2 },
      { label: 'SOS Feed', href: '/admin/sos-feed', icon: AlertTriangle },
      { label: 'Backlog', href: '/admin/backlog', icon: Kanban },
      { label: 'Quotes', href: '/admin/quotes', icon: Sparkles },
      { label: 'Wellness', href: '/admin/wellness', icon: Flower2 },
      { label: 'Self-Help Guides', href: '/admin/help-guides', icon: GraduationCap },
      { label: 'Providers', href: '/admin/providers', icon: Briefcase },
      { label: 'Volunteers', href: '/admin/volunteers', icon: HeartHandshake },
      { label: 'Newsletters', href: '/admin/newsletters', icon: Mail },
      { label: 'WhatsApp Invite', href: '/admin/invite', icon: MessageCircle },
      { label: 'Settings', href: '/admin/settings', icon: Settings },
      { label: 'Profile', href: '/admin/profile', icon: User },
    ],
  },
  provider: {
    label: 'Provider',
    items: [
      { label: 'Overview', href: '/provider', icon: LayoutDashboard },
      { label: 'Catalog', href: '/provider/catalog', icon: Package },
      { label: 'Orders', href: '/provider/orders', icon: PackageCheck },
    ],
  },
};

function LanguageToggle({ compact }: { compact?: boolean }) {
  const lang = useLanguage();
  if (!lang || !lang.secondaryLanguage) return null;

  return (
    <button
      onClick={lang.toggle}
      aria-label={`Switch language to ${languageLabel(lang.secondaryLanguage)}`}
      className={cn(
        'flex items-center gap-2 rounded-full border border-border bg-bg font-semibold text-text-secondary hover:bg-primary-50 hover:text-primary-900 pointer-coarse:py-3',
        compact ? 'px-3 py-2 text-xs' : 'w-full justify-center px-3 py-3 text-sm',
      )}
    >
      <Languages className="h-4 w-4 shrink-0" />
      <span>{languageLabel(lang.language)}</span>
    </button>
  );
}

interface AppShellProps {
  role: PortalRole;
  userName?: string;
  children: React.ReactNode;
}

export function AppShell({ role, userName, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { label: portalLabel, items: navItems } = NAV_CONFIG[role];

  async function handleLogout() {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-bg lg:flex">
      {/* Sidebar — tablet landscape and up */}
      <aside className="hidden shrink-0 border-r border-border bg-surface md:flex md:w-20 md:flex-col lg:w-64">
        <div className="flex h-16 items-center gap-2 border-b border-border px-4 lg:px-6">
          <span className="text-2xl font-black text-primary-600">EC</span>
          <span className="hidden text-sm font-semibold text-text-secondary lg:inline">{portalLabel}</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors pointer-coarse:py-4',
                  active
                    ? 'bg-primary-50 text-primary-900'
                    : 'text-text-secondary hover:bg-primary-50 hover:text-primary-900',
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <div className="hidden lg:block lg:pb-2">
            <LanguageToggle />
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-text-secondary hover:bg-danger-50 hover:text-danger-900"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className="hidden lg:inline">Log out</span>
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-4 md:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black text-primary-600">EC</span>
          <span className="text-sm font-semibold text-text-secondary">{portalLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle compact />
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-primary-50"
          >
            <Menu className="h-6 w-6 text-text" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 bg-surface p-4 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-text-secondary">{userName ?? portalLabel}</span>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-primary-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold',
                      active ? 'bg-primary-50 text-primary-900' : 'text-text-secondary hover:bg-primary-50',
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className="mt-2 flex items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold text-danger-600 hover:bg-danger-50"
              >
                <LogOut className="h-5 w-5" />
                Log out
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-0">
        <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
          {children}
          <footer className="mt-12 flex justify-center gap-4 border-t border-border pt-6 text-xs text-text-secondary">
            <Link href="/newsletter" className="hover:text-primary-600 hover:underline">Newsletter</Link>
            <Link href="/terms" className="hover:text-primary-600 hover:underline">Terms &amp; Conditions</Link>
            <Link href="/privacy" className="hover:text-primary-600 hover:underline">Privacy Policy</Link>
          </footer>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-surface py-2 md:hidden">
        {navItems.slice(0, 4).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold pointer-coarse:py-3',
                active ? 'text-primary-600' : 'text-text-secondary',
              )}
            >
              <item.icon className="h-6 w-6" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {role === 'elder' && (
        <>
          <ReminderAlerts />
          <VoiceAssistant />
        </>
      )}
    </div>
  );
}
