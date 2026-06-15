'use client';
import { useState } from 'react';
import type { Tax } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { deleteTax } from '@/lib/actions/tax.actions';
import TaxFormDialog from './TaxFormDialog';
import { useToast } from '@/hooks/use-toast';

function ActionsMenu({ tax }: { tax: Tax }) {
    const { toast } = useToast();
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const handleDelete = async () => {
        await deleteTax(tax.id);
        toast({ title: "Impuesto eliminado" });
        setIsDeleteDialogOpen(false);
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" id="taxestable-button-1" data-testid="taxestable-action-button"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setIsDeleteDialogOpen(true)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <TaxFormDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} tax={tax} />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Está seguro de eliminar?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Esto eliminará permanentemente el impuesto "{tax.name}".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}


export default function TaxesTable({ taxes }: { taxes: Tax[] }) {
    if (taxes.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                No se encontraron impuestos.
            </div>
        );
    }
    
    return (
        <>
            {/* Vista para móviles (Tarjetas) */}
            <div className="md:hidden space-y-4">
                {taxes.map((tax) => (
                    <div key={tax.id} className="p-4 border rounded-xl bg-card/50 backdrop-blur-sm space-y-3 relative transition-all hover:bg-card">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold">{tax.name}</span>
                                    <span className="text-primary font-black">{tax.percentage}%</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {tax.description || 'Sin descripción'}
                                </p>
                            </div>
                            <ActionsMenu tax={tax} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Vista para escritorio (Tabla) */}
            <div className="hidden md:block rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Porcentaje</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {taxes.map((tax) => (
                            <TableRow key={tax.id}>
                                <TableCell className="font-medium">{tax.name}</TableCell>
                                <TableCell>{tax.percentage}%</TableCell>
                                <TableCell className="text-muted-foreground">{tax.description || '-'}</TableCell>
                                <TableCell className="text-right">
                                    <ActionsMenu tax={tax} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </>
    );
}
