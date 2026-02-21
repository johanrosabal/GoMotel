'use client';

import type { PurchaseInvoice } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Trash2, XCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

function ActionsMenu({ purchase }: { purchase: PurchaseInvoice }) {
    const { toast } = useToast();
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);
    const isVoided = purchase.status === 'Anulada';

    // Placeholder handlers
    const handleDelete = () => {
        toast({ title: "Funcionalidad no implementada", description: "La eliminación de facturas de compra se añadirá próximamente." });
        setIsDeleteDialogOpen(false);
    }
    const handleVoid = () => {
        toast({ title: "Funcionalidad no implementada", description: "La anulación de facturas de compra se añadirá próximamente." });
        setIsVoidDialogOpen(false);
    }
    const handleEdit = () => {
        toast({ title: "Funcionalidad no implementada", description: "La edición de facturas de compra se añadirá próximamente." });
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={isVoided}><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleEdit} disabled={isVoided}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setIsVoidDialogOpen(true)} disabled={isVoided}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Anular
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Void Dialog */}
            <AlertDialog open={isVoidDialogOpen} onOpenChange={setIsVoidDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Está seguro de anular esta factura?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. La factura N° {purchase.invoiceNumber} se marcará como anulada.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleVoid}>Anular Factura</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            {/* Delete Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Está seguro de eliminar esta factura?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Esto eliminará permanentemente la factura N° {purchase.invoiceNumber} y no se revertirá la entrada de inventario.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar Permanentemente</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
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
                                <Badge variant={purchase.status === 'Anulada' ? 'destructive' : 'default'} className={cn(purchase.status === 'Anulada' ? 'bg-red-200/50 text-red-700' : 'bg-green-100 text-green-800')}>
                                    {purchase.status || 'Activa'}
                                </Badge>
                            </TableCell>
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
