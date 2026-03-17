'use client';

import { Suspense } from 'react';
import PublicOrderClient from '@/components/public/order/PublicOrderClient';
import { Skeleton } from '@/components/ui/skeleton';

export default function PublicOrderPage() {
  return (
    <main className="min-h-screen bg-background dark">
      <Suspense fallback={<PublicOrderLoading />}>
        <PublicOrderClient />
      </Suspense>
    </main>
  );
}

function PublicOrderLoading() {
  return (
    <div className="container max-w-lg p-6 space-y-8">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}