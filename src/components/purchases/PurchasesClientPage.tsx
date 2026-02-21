'use client';

import { useState } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { PurchaseInvoice } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import PurchaseInvoiceFormDialog from './PurchaseInvoiceFormDialog';
import PurchaseInvoicesTable from './PurchaseInvoicesTable';

export default function PurchasesClientPage() {
  const { firestore } = useFirebase();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const purchasesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "purchaseInvoices"), orderBy("createdAt", "desc"));
  }, [firestore]);

  const { data: purchaseInvoices, isLoading } = useCollection<PurchaseInvoice>(purchasesQuery);

  return (
    <div className="space-y-4">
       <div className="flex justify-end">
          <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Registrar Factura de Compra
          </Button>
          <PurchaseInvoiceFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} />
      </div>
      {isLoading ? (
        <div className="space-y-2 rounded-md border p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <PurchaseInvoicesTable purchases={purchaseInvoices || []} />
      )}
    </div>
  );
}
