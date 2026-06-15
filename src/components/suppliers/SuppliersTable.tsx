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
                        <Button variant="outline" size="icon" className="h-8 w-8" asChild id="supplierstable-button-1" data-testid="supplierstable-action-button">
                            <a href={gmapsUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} data-testid="supplierstable-action-link">
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
                        <Button variant="outline" size="icon" className="h-8 w-8" asChild id="supplierstable-button-2" data-testid="supplierstable-action-button">
                            <a href={wazeUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} data-testid="supplierstable-action-link">
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
                    <Button variant="ghost" size="icon" id="supplierstable-button-3" data-testid="supplierstable-action-button"><MoreHorizontal className="h-4 w-4" /></Button>
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
            <div className="text-center text-slate-500 py-16 border-2 border-dashed border-white/5 rounded-2xl bg-slate-900/20">
                No se encontraron proveedores.
            </div>
        );
    }
    
    return (
        <div>
            {/* Vista de Escritorio */}
            <div className="hidden md:block">
                <Table>
                    <TableHeader className="bg-slate-800/50">
                        <TableRow className="border-white/5 hover:bg-transparent">
                            <TableHead className="text-slate-400 font-bold">Nombre del Proveedor</TableHead>
                            <TableHead className="text-slate-400 font-bold">Contacto</TableHead>
                            <TableHead className="text-slate-400 font-bold">Email</TableHead>
                            <TableHead className="text-slate-400 font-bold">Teléfono</TableHead>
                            <TableHead className="text-slate-400 font-bold">Ubicación</TableHead>
                            <TableHead className="text-right text-slate-400 font-bold">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {suppliers.map((supplier) => (
                            <TableRow key={supplier.id} className="border-white/5 hover:bg-white/5 transition-colors">
                                <TableCell className="font-medium text-white">{supplier.name}</TableCell>
                                <TableCell className="text-slate-300">{supplier.contactName || '-'}</TableCell>
                                <TableCell className="text-slate-300">{supplier.email || '-'}</TableCell>
                                <TableCell className="text-slate-300">{supplier.phone || '-'}</TableCell>
                                <TableCell>
                                    {supplier.googleMapsUrl ? <LocationButtons url={supplier.googleMapsUrl} /> : <span className="text-slate-500">-</span>}
                                </TableCell>
                                <TableCell className="text-right">
                                    <ActionsMenu supplier={supplier} onEdit={onEdit} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Vista de Móvil (Tarjetas) */}
            <div className="md:hidden grid gap-4 p-4">
                {suppliers.map((supplier) => (
                    <div key={supplier.id} className="bg-slate-800/30 p-4 rounded-xl border border-white/5 space-y-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-white">{supplier.name}</h3>
                                <p className="text-xs text-slate-400">{supplier.contactName || 'Sin contacto'}</p>
                            </div>
                            <ActionsMenu supplier={supplier} onEdit={onEdit} />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <span className="text-slate-500 block uppercase font-bold text-[10px]">Email</span>
                                <span className="text-slate-300 break-all">{supplier.email || '-'}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block uppercase font-bold text-[10px]">Teléfono</span>
                                <span className="text-slate-300">{supplier.phone || '-'}</span>
                            </div>
                        </div>

                        {supplier.googleMapsUrl && (
                            <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400">Ubicación:</span>
                                <LocationButtons url={supplier.googleMapsUrl} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

    