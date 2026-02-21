'use client';

import { useState, useTransition, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Service, Supplier } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { registerPurchase } from '@/lib/actions/purchase.actions';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all');

  const servicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'services'), orderBy('name'));
  }, [firestore]);
  const { data: services, isLoading: isLoadingServices } = useCollection<Service>(servicesQuery);
  
  const suppliersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'suppliers'), orderBy('name'));
  }, [firestore]);
  const { data: suppliers, isLoading: isLoadingSuppliers } = useCollection<Supplier>(suppliersQuery);

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

  const filteredServices = useMemo(() => {
    if (!services) return [];
    if (selectedSupplierId === 'all') return services;
    return services.filter(s => s.supplierId === selectedSupplierId);
  }, [services, selectedSupplierId]);

  const isLoading = isLoadingServices || isLoadingSuppliers;
  const buttonText = isPending 
    ? 'Registrando...' 
    : `Registrar Compra (${itemsToSubmit.length})`;

  return (
    <div className="space-y-4">
       <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId} disabled={isLoading}>
          <SelectTrigger className="w-full sm:w-[280px]">
            <SelectValue placeholder="Filtrar por proveedor..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mostrar todos los productos</SelectItem>
            {suppliers?.map(supplier => (
              <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
         <Button onClick={handleSubmit} disabled={isPending || itemsToSubmit.length === 0} className="w-full sm:w-auto">
            <Save className="mr-2 h-4 w-4" />
            {buttonText}
        </Button>
      </div>
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
                        {filteredServices?.map(service => (
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
                 {filteredServices.length === 0 && (
                    <div className="text-center p-8 text-muted-foreground">
                        {selectedSupplierId === 'all' ? 'No hay productos en el catálogo.' : 'Este proveedor no tiene productos asignados.'}
                    </div>
                 )}
            </div>
             <div className="flex justify-end">
                <Button onClick={handleSubmit} disabled={isPending || itemsToSubmit.length === 0}>
                    <Save className="mr-2 h-4 w-4" />
                    {buttonText}
                </Button>
            </div>
        </>
      )}
    </div>
  );
}