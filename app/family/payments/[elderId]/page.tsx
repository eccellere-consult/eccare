'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PaymentsDue } from '@/components/payments-due';

export default function FamilyPaymentsPage({ params }: { params: Promise<{ elderId: string }> }) {
  const { elderId } = use(params);

  return (
    <div>
      <Link href="/family/payments" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-2xl font-bold text-text">Payments</h1>
      <p className="mt-1 text-text-secondary">Association fees for this elder&apos;s home.</p>
      <div className="mt-6">
        <PaymentsDue elderUserId={elderId} />
      </div>
    </div>
  );
}
