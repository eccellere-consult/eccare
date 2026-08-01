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
  Heart,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type PortalRole = 'elder' | 'family' | 'admin' | 'provider';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV_CONFIG: Record<PortalRole, { label: string; items: NavItem[] }> = {
  elder: {
    label: 'Elder',
    items: [
      { label: 'Home', href: '/elder', icon: Home },
      { label: 'Contacts', href: '/elder/contacts', icon: Users },
      { label: 'Profile', href: '/elder/profile', icon: User },
    ],
  },
  family: {
    label: 'Family',
    items: [
      { label: 'Dashboard', href: '/family', icon: LayoutDashboard },
      { label: 'Health', href: '/family/health', icon: Heart },
      { label: 'Contacts', href: '/family/contacts', icon: Users },
      { label: 'SOS History', href: '/family/sos-history', icon: AlertTriangle },
      { label: 'Invite Elder', href: '/family/invite', icon: UserPlus },
    ],
  },
  admin: {
    label: 'Admin',
    items: [
      { label: 'Users', href: '/admin/users', icon: Users },
      { label: 'SOS Feed', href: '/admin/sos-feed', icon: AlertTriangle },
      { label: 'Backlog', href: '/admin/backlog', icon: Kanban },
    ],
  },
  provider: {
    label: 'Provider',
    items: [{ label: 'Requests', href: '/provider', icon: LayoutDashboard }],
  },
};

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
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-primary-50"
        >
          <Menu className="h-6 w-6 text-text" />
        </button>
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
        <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">{children}</div>
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
    </div>
  );
}
