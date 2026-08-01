import { Suspense } from 'react';
import HealthClient from './health-client';

export default function HealthPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <Suspense fallback={<div>Loading...</div>}>
          <HealthClient />
        </Suspense>
      </div>
    </div>
  );
}
