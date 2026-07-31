'use client';

import { Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { useCommunityData } from '@/lib/community-client';

interface Helpline {
  id: string;
  label: string;
  phone: string;
  category: string;
}

export default function HelplinesPage() {
  const { data, loading, error } = useCommunityData<Helpline[]>('/community/helplines');

  return (
    <CommunityPageFrame
      title="Helpline numbers"
      subtitle="Tap any number to call straight away."
      loading={loading}
      error={error}
      isEmpty={(data?.length ?? 0) === 0}
      emptyMessage="Your committee hasn't added helpline numbers yet."
    >
      <div className="flex flex-col gap-3">
        {data?.map((h) => (
          // A plain tel: link rather than a JS handler — it works on every device and
          // needs no permission, which matters most for the emergency case.
          <a key={h.id} href={`tel:${h.phone}`} className="block">
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 py-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-danger-50">
                  <Phone className="h-5 w-5 text-danger-600" />
                </span>
                <span className="flex-1">
                  <span className="block text-lg font-bold text-text">{h.label}</span>
                  <span className="block text-text-secondary">{h.phone}</span>
                </span>
                <span className="rounded-xl bg-danger-600 px-4 py-2 font-semibold text-white">Call</span>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </CommunityPageFrame>
  );
}
