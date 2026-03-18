'use client';

import type { PurchaseInvoice } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, XCircle, Eye, ArchiveX } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useState, useTransition } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { voidPurchaseInvoice } from '@/lib/actions/purchase.actions';
import SpoilageFormDialog from './SpoilageFormDialog';

function ActionsMenu({ purchase, onView }: { purchase: PurchaseInvoice, onView: (p: PurchaseInvoice) => void }) {
    const { toast } = useToast();
    const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);
    const [isSpoilageDialogOpen, setIsSpoilageDialogOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const isVoided = purchase.status === 'Anulada';

    const handleVoid = () => {
        setIsVoidDialogOpen(false);
        startTransition(async () => {
            const result = await voidPurchaseInvoice(purchase.id);
            if (result.error) {
                toast({ title: "Error al anular", description: result.error, variant: 'destructive' });
            } else {
                toast({ title: "Factura anulada", description: result.success });
            }
        });
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={isPending} id="purchaseinvoicestable-button-1"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => onView(purchase)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver Detalle
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setIsVoidDialogOpen(true)} disabled={isVoided}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Anular Factura
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setIsSpoilageDialogOpen(true)} disabled={isVoided}>
                        <ArchiveX className="mr-2 h-4 w-4" />
                        Registrar Merma
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Void Dialog */}
            <AlertDialog open={isVoidDialogOpen} onOpenChange={setIsVoidDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Está seguro de anular esta factura?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción revertirá las cantidades de inventario de esta factura y no se puede deshacer. La factura N° {purchase.invoiceNumber} se marcará como anulada.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleVoid} disabled={isPending}>Anular Factura</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <SpoilageFormDialog
                open={isSpoilageDialogOpen}
                onOpenChange={setIsSpoilageDialogOpen}
                purchaseInvoice={purchase}
            />
        </>
    );
}


export default function PurchaseInvoicesTable({ purchases, onView }: { purchases: PurchaseInvoice[], onView: (p: PurchaseInvoice) => void }) {
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
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Monto Total</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {purchases.map((purchase) => (
                        <TableRow key={purchase.id} className={cn(purchase.status === 'Anulada' && 'text-muted-foreground bg-muted/50')}>
                            <TableCell className="font-mono">
                                <Badge variant="outline">{purchase.invoiceNumber}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{purchase.supplierName}</TableCell>
                            <TableCell>{format(purchase.invoiceDate.toDate(), "dd MMM yyyy", { locale: es })}</TableCell>
                            <TableCell>
                                <Badge variant={purchase.status === 'Anulada' ? 'destructive' : 'default'} className={cn(
                                    purchase.status === 'Anulada' 
                                    ? 'bg-red-200/50 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                                    : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    )}>
                                    {purchase.status || 'Activa'}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(purchase.totalAmount)}</TableCell>
                            <TableCell className="text-right">
                                <ActionsMenu purchase={purchase} onView={onView} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
