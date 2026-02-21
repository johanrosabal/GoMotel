'use client';
import { useState } from 'react';
import type { Supplier } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Trash2, Map, Car } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { deleteSupplier } from '@/lib/actions/supplier.actions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

function LocationButtons({ url }: { url: string }) {
    const latLngMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (!latLngMatch) return null;

    const [, lat, lng] = latLngMatch;

    const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;

    return (
        <div className="flex items-center gap-1">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                            <a href={gmapsUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                <Map className="h-4 w-4" />
                                <span className="sr-only">Abrir en Google Maps</span>
                            </a>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Abrir en Google Maps</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                            <a href={wazeUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                <Car className="h-4 w-4" />
                                <span className="sr-only">Navegar con Waze</span>
                            </a>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Navegar con Waze</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
}

function ActionsMenu({ supplier, onEdit }: { supplier: Supplier, onEdit: (supplier: Supplier) => void }) {
    const { toast } = useToast();
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const handleDelete = async () => {
        await deleteSupplier(supplier.id);
        toast({ title: "Proveedor eliminado" });
        setIsDeleteDialogOpen(false);
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => onEdit(supplier)}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setIsDeleteDialogOpen(true)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Está seguro de eliminar?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Esto eliminará permanentemente al proveedor "{supplier.name}".
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

export default function SuppliersTable({ suppliers, onEdit }: { suppliers: Supplier[], onEdit: (supplier: Supplier) => void }) {
    if (suppliers.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                No se encontraron proveedores.
            </div>
        );
    }
    
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nombre del Proveedor</TableHead>
                        <TableHead>Contacto</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Ubicación</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {suppliers.map((supplier) => (
                        <TableRow key={supplier.id}>
                            <TableCell className="font-medium">{supplier.name}</TableCell>
                            <TableCell className="text-muted-foreground">{supplier.contactName || '-'}</TableCell>
                             <TableCell className="text-muted-foreground">{supplier.email || '-'}</TableCell>
                              <TableCell className="text-muted-foreground">{supplier.phone || '-'}</TableCell>
                            <TableCell>
                                {supplier.googleMapsUrl ? <LocationButtons url={supplier.googleMapsUrl} /> : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="text-right">
                                <ActionsMenu supplier={supplier} onEdit={onEdit} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

    