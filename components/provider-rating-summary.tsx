import { Star } from 'lucide-react';
import type { ProviderRatingSummary } from '@/lib/ratings';

/** Read-only "★ 4.6 (12 reviews)" display, used wherever a provider is
 *  listed (vendor/doctor/driver cards, advisory expert, property-management
 *  picker). Renders nothing when there are no ratings yet, rather than a
 *  misleading "0 stars". */
export function ProviderRatingSummaryDisplay({ summary }: { summary: ProviderRatingSummary }) {
  if (summary.count === 0 || summary.average == null) return null;

  return (
    <span className="flex items-center gap-1 text-sm font-semibold text-text-secondary">
      <Star className="h-3.5 w-3.5 text-accent-600" fill="currentColor" />
      {summary.average.toFixed(1)}
      <span className="font-normal text-text-secondary">
        ({summary.count} review{summary.count === 1 ? '' : 's'})
      </span>
    </span>
  );
}
