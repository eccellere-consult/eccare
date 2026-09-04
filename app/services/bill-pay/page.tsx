'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { BillPaySection } from '@/components/bill-pay-section';

function BillPayContent() {
  const searchParams = useSearchParams();
  const elderUserId = searchParams.get('elderUserId') ?? undefined;

  return (
    <div>
      <Link href="/services" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600">
        <ArrowLeft className="h-4 w-4" /> Services
      </Link>

      {/* BillPaySection renders its own "Bill Pay" heading + description —
          no page-level h1 here, to avoid a duplicate title stacked on top. */}
      <BillPaySection elderUserId={elderUserId} />
    </div>
  );
}

export default function BillPayPage() {
  return (
    <Suspense fallback={null}>
      <BillPayContent />
    </Suspense>
  );
}
