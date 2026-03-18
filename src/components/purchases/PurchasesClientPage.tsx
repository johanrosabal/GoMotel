'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { PurchaseInvoice } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import PurchaseInvoiceFormDialog from './PurchaseInvoiceFormDialog';
import PurchaseInvoicesTable from './PurchaseInvoicesTable';
import { Input } from '../ui/input';

export default function PurchasesClientPage() {
  const { firestore } = useFirebase();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseInvoice | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [isReadOnly, setIsReadOnly] = useState(false);

  const purchasesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "purchaseInvoices"), orderBy("createdAt", "desc"));
  }, [firestore]);

  const { data: purchaseInvoices, isLoading } = useCollection<PurchaseInvoice>(purchasesQuery);

  const filteredInvoices = useMemo(() => {
    if (!purchaseInvoices) return [];
    return purchaseInvoices.filter(invoice => {
        const searchContent = `${invoice.invoiceNumber} ${invoice.supplierName}`.toLowerCase();
        return searchContent.includes(searchTerm.toLowerCase());
    });
  }, [purchaseInvoices, searchTerm]);
  
  const handleView = (purchase: PurchaseInvoice) => {
    setEditingPurchase(purchase);
    setIsReadOnly(true);
    setIsFormOpen(true);
  };
  
  const handleAdd = () => {
    setEditingPurchase(undefined);
    setIsReadOnly(false);
    setIsFormOpen(true);
  };


  return (
    <div className="space-y-4">
       <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <Input
              placeholder="Buscar por N° de factura o proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm" id="purchasesclientpage-input-buscar-por-n"
          />
          <Button onClick={handleAdd} id="purchasesclientpage-button-registrar-factura-de">
            <PlusCircle className="mr-2 h-4 w-4" />
            Registrar Factura de Compra
          </Button>
          <PurchaseInvoiceFormDialog 
            open={isFormOpen} 
            onOpenChange={setIsFormOpen} 
            purchaseInvoice={editingPurchase}
            readOnly={isReadOnly}
          />
      </div>
      {isLoading ? (
        <div className="space-y-2 rounded-md border p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <PurchaseInvoicesTable purchases={filteredInvoices} onView={handleView} />
      )}
    </div>
  );
}
