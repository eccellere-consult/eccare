'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { MemoriesGallery } from '@/components/memories-gallery';

export default function FamilyMemoriesPage({ params }: { params: Promise<{ elderId: string }> }) {
  const { elderId } = use(params);

  return (
    <div>
      <Link href="/family/memories" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-2xl font-bold text-text">Memories</h1>
      <p className="mt-1 text-text-secondary">Photos shared between you and this elder.</p>
      <div className="mt-6">
        <MemoriesGallery elderUserId={elderId} />
      </div>
    </div>
  );
}
