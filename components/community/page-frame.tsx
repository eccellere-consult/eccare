'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/** Shared chrome for every community sub-page: back link, heading, and the
 *  loading / error / empty states so each page only writes its real content. */
export function CommunityPageFrame({
  title,
  subtitle,
  action,
  loading,
  error,
  isEmpty,
  emptyMessage,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <Link
        href="/community"
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Community
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">{title}</h1>
          {subtitle && <p className="mt-1 text-text-secondary">{subtitle}</p>}
        </div>
        {action}
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-text-secondary">Loading…</p>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center text-danger-600">{error}</CardContent>
          </Card>
        ) : isEmpty ? (
          <Card>
            <CardContent className="py-12 text-center text-text-secondary">
              {emptyMessage ?? 'Nothing here yet.'}
            </CardContent>
          </Card>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
