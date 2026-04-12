'use client';

import PaymentsFinanceClient from '@/components/finance/PaymentsFinanceClient';

export default function FinancePaymentsPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-hidden">
      <div className="container relative z-10 py-12 lg:py-20 space-y-12 max-w-7xl">
        <PaymentsFinanceClient />
      </div>
    </div>
  );
}
