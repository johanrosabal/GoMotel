'use client';

import type { PurchaseInvoice } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel } from '@/components/ui/dropdown-menu';

function ActionsMenu({ purchase }: { purchase: PurchaseInvoice }) {
    // Actions like view details can be added later
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default function PurchaseInvoicesTable({ purchases }: { purchases: PurchaseInvoice[] }) {
    if (purchases.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                No se han registrado facturas de compra.
            </div>
        );
    }
    
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Factura N°</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Monto Total</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {purchases.map((purchase) => (
                        <TableRow key={purchase.id}>
                            <TableCell className="font-mono">
                                <Badge variant="outline">{purchase.invoiceNumber}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{purchase.supplierName}</TableCell>
                            <TableCell>{format(purchase.invoiceDate.toDate(), "dd MMM yyyy", { locale: es })}</TableCell>
                            <TableCell className="text-right">{formatCurrency(purchase.totalAmount)}</TableCell>
                            <TableCell className="text-right">
                                <ActionsMenu purchase={purchase} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
