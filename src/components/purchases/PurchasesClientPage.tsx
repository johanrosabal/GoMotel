'use client';

import { useState, useTransition } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Service } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { registerPurchase } from '@/lib/actions/purchase.actions';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '../ui/badge';

type PurchaseItem = {
  serviceId: string;
  serviceName: string;
  quantity: number;
};

export default function PurchasesClientPage() {
  const { firestore } = useFirebase();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [purchaseItems, setPurchaseItems] = useState<Record<string, number>>({});

  const servicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'services'), orderBy('name'));
  }, [firestore]);

  const { data: services, isLoading } = useCollection<Service>(servicesQuery);

  const handleQuantityChange = (serviceId: string, quantityStr: string) => {
    const quantity = parseInt(quantityStr, 10);
    setPurchaseItems(prev => ({
      ...prev,
      [serviceId]: isNaN(quantity) || quantity < 0 ? 0 : quantity,
    }));
  };
  
  const itemsToSubmit = Object.entries(purchaseItems)
    .filter(([, quantity]) => quantity > 0)
    .map(([serviceId, quantity]) => {
        const service = services?.find(s => s.id === serviceId);
        return {
            serviceId,
            serviceName: service?.name || 'Desconocido',
            quantity,
        };
    });

  const handleSubmit = () => {
    if (itemsToSubmit.length === 0) {
        toast({ title: 'Nada que registrar', description: 'Por favor, ingrese la cantidad de al menos un producto.', variant: 'destructive' });
        return;
    }

    startTransition(async () => {
      const result = await registerPurchase(itemsToSubmit);
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: '¡Éxito!', description: 'La compra ha sido registrada y el inventario actualizado.' });
        setPurchaseItems({});
      }
    });
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-2 rounded-md border p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <>
            <div className="rounded-md border">
                 <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead className="text-right">Stock Actual</TableHead>
                        <TableHead className="w-[150px] text-right">Cantidad Comprada</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {services?.map(service => (
                        <TableRow key={service.id}>
                            <TableCell className="font-medium">{service.name}</TableCell>
                            <TableCell><Badge variant="outline">{service.code}</Badge></TableCell>
                            <TableCell className="text-right">{service.stock}</TableCell>
                            <TableCell className="text-right">
                                <Input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={purchaseItems[service.id] || ''}
                                    onChange={(e) => handleQuantityChange(service.id, e.target.value)}
                                    className="text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                 </Table>
            </div>
             <div className="flex justify-end">
                <Button onClick={handleSubmit} disabled={isPending || itemsToSubmit.length === 0}>
                    <Save className="mr-2 h-4 w-4" />
                    {isPending ? 'Registrando...' : 'Registrar Compra'}
                </Button>
            </div>
        </>
      )}
    </div>
  );
}
