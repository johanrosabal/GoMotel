'use client';

import type { Stay } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Eye, Clock, CheckCircle2, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useState } from 'react';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useFirebase } from '@/firebase';
import { doc, deleteDoc, updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function StaysTable({ stays }: { stays: Stay[] }) {
    const [selectedStay, setSelectedStay] = useState<Stay | null>(null);
    const [stayToDelete, setStayToDelete] = useState<Stay | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const { userProfile } = useUserProfile();
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const handleDeleteStay = async () => {
        if (!stayToDelete || !firestore) return;
        
        setIsDeleting(true);
        try {
            const batch = writeBatch(firestore);
            batch.delete(doc(firestore, 'stays', stayToDelete.id));

            // Also delete associated invoices for this stay
            const invQuery = query(collection(firestore, 'invoices'), where('stayId', '==', stayToDelete.id));
            const invSnap = await getDocs(invQuery);
            invSnap.forEach((invDoc) => {
              batch.delete(invDoc.ref);
            });

            if (!stayToDelete.checkOut) {
                batch.update(doc(firestore, 'rooms', stayToDelete.roomId), {
                    status: 'Available',
                    currentStayId: null
                });
            }

            await batch.commit();
            
            toast({
                title: "Estancia eliminada",
                description: "La estancia se ha eliminado correctamente.",
            });
        } catch (error) {
            console.error("Error deleting stay:", error);
            toast({
                title: "Error",
                description: "No se pudo eliminar la estancia.",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setStayToDelete(null);
        }
    };

    if (stays.length === 0) {
        return (
            <div className="text-center text-slate-500 font-bold uppercase tracking-wider py-16 bg-black/20 border border-dashed border-white/5 rounded-2xl m-4">
                No se encontraron estancias con los filtros actuales.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader className="bg-black/40">
                    <TableRow className="border-white/5 hover:bg-transparent">
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 py-4">Huésped</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 py-4">Habitación</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 py-4">Check-in</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 py-4">Check-out</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 py-4">Total</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 py-4">Registrado Por</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 py-4">Estado</TableHead>
                        <TableHead className="w-[80px]"><span className="sr-only">Acciones</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {stays.map(stay => (
                        <TableRow key={stay.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                            <TableCell className="font-bold text-white py-4">{stay.guestName}</TableCell>
                            <TableCell className="font-mono text-slate-300">{stay.roomNumber}</TableCell>
                            <TableCell className="text-slate-300 text-sm">
                                {format(stay.checkIn.toDate(), "dd MMM, h:mm a", { locale: es })}
                            </TableCell>
                            <TableCell className="text-slate-300 text-sm">
                                {stay.checkOut ? format(stay.checkOut.toDate(), "dd MMM, h:mm a", { locale: es }) : (
                                    <span className="text-slate-600 font-medium">En curso...</span>
                                )}
                            </TableCell>
                            <TableCell className="font-bold text-white font-mono">
                                {stay.isPaid ? formatCurrency(stay.total) : (
                                    <span className="text-slate-600">-</span>
                                )}
                            </TableCell>
                            <TableCell className="text-slate-300 text-sm">
                                {(stay as any).createdBy || 'N/D'}
                            </TableCell>
                            <TableCell>
                                {stay.checkOut ? (
                                    <div className="flex items-center gap-1.5 text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/20 w-fit">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Completada
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 w-fit">
                                        <Clock className="h-3 w-3 animate-pulse" />
                                        Activa
                                    </div>
                                )}
                            </TableCell>
                            <TableCell className="text-right py-4">
                                <div className="flex items-center justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => setSelectedStay(stay)} className="h-9 w-9 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all" id="staystable-button-1" data-testid="staystable-see-details-button">
                                        <Eye className="h-4 w-4" />
                                        <span className="sr-only">Ver Detalles</span>
                                    </Button>
                                    {userProfile?.role === 'Administrador' && (
                                        <Button variant="ghost" size="icon" onClick={() => setStayToDelete(stay)} className="h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all">
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Eliminar</span>
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <Dialog open={!!selectedStay} onOpenChange={(open) => !open && setSelectedStay(null)}>
                <DialogContent className="bg-slate-950 border-white/10 text-white rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Detalles de la Estancia</DialogTitle>
                    </DialogHeader>
                    {selectedStay && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Huésped</p>
                                    <p className="font-bold text-white">{selectedStay.guestName}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Habitación</p>
                                    <p className="font-mono text-slate-300">{selectedStay.roomNumber}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Check-in</p>
                                    <p className="text-slate-300">{format(selectedStay.checkIn.toDate(), "dd MMM yyyy, h:mm a", { locale: es })}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Check-out</p>
                                    <p className="text-slate-300">{selectedStay.checkOut ? format(selectedStay.checkOut.toDate(), "dd MMM yyyy, h:mm a", { locale: es }) : 'En curso...'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total</p>
                                    <p className="font-bold font-mono text-white">{selectedStay.isPaid ? formatCurrency(selectedStay.total) : '-'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Plan Seleccionado</p>
                                    <p className="text-slate-300">{selectedStay.pricePlanName || 'N/D'} {selectedStay.pricePlanAmount ? `(${formatCurrency(selectedStay.pricePlanAmount)})` : ''}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Método de Pago</p>
                                    <p className="text-slate-300">{selectedStay.paymentMethod || 'N/D'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Estado de Pago</p>
                                    <p className="text-slate-300">
                                        {selectedStay.paymentStatus ? (
                                            <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold", selectedStay.paymentStatus === 'Pagado' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500")}>
                                                {selectedStay.paymentStatus}
                                            </span>
                                        ) : 'N/D'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Registrado Por</p>
                                    <p className="text-slate-300">{(selectedStay as any).createdBy || 'N/D'}</p>
                                </div>
                            </div>
                            {selectedStay.checkOutReason && (
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Razón de Check-out</p>
                                    <p className="text-slate-300 mt-1">{selectedStay.checkOutReason}</p>
                                </div>
                            )}
                            {(selectedStay.checkOutNotes || (selectedStay as any).notes) && (
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Notas</p>
                                    <p className="text-slate-300 mt-1">{selectedStay.checkOutNotes || (selectedStay as any).notes}</p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!stayToDelete} onOpenChange={(open) => !open && setStayToDelete(null)}>
                <AlertDialogContent className="bg-slate-950 border-white/10 text-white rounded-[2rem]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Está seguro de eliminar esta estancia?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                            Esta acción no se puede deshacer. Esto eliminará permanentemente el registro de la estancia
                            {stayToDelete && !stayToDelete.checkOut ? " y liberará la habitación actual." : "."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-transparent border-white/10 hover:bg-white/5 rounded-xl text-slate-300">Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteStay();
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-xl"
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Eliminando..." : "Eliminar Estancia"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
