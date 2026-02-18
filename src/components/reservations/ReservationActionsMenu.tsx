'use client';

import { useTransition } from 'react';
import type { Reservation } from '@/types';
import { MoreHorizontal, LogIn, XCircle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { checkInFromReservation, cancelReservation, checkOutEarlyFromReservation } from '@/lib/actions/reservation.actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { cn } from '@/lib/utils';

export default function ReservationActionsMenu({ reservation, className }: { reservation: Reservation, className?: string }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const handleCheckIn = () => {
        startTransition(async () => {
            const result = await checkInFromReservation(reservation.id);
            if (result?.error) {
                toast({ title: 'Error en Check-in', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Éxito!', description: `Huésped ${reservation.guestName} ha sido registrado.` });
            }
        });
    }

    const handleCancel = () => {
        startTransition(async () => {
            const result = await cancelReservation(reservation.id);
            if (result?.error) {
                toast({ title: 'Error', description: 'No se pudo cancelar la reservación.', variant: 'destructive' });
            } else {
                toast({ title: 'Reservación Cancelada', description: 'La reservación ha sido cancelada.' });
            }
        });
    }
    
    const handleEarlyCheckOut = () => {
        startTransition(async () => {
            const result = await checkOutEarlyFromReservation(reservation.id);
            if (result?.error) {
                toast({ title: 'Error en Check-out', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Check-out Exitoso!', description: `${reservation.guestName} ha finalizado su estancia.` });
            }
        });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button aria-haspopup="true" size="icon" variant="ghost" disabled={isPending} className={className}>
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Toggle menu</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {reservation.status === 'Confirmed' && (
                    <>
                        <DropdownMenuItem onClick={handleCheckIn} disabled={isPending}>
                            <LogIn className="mr-2 h-4 w-4" />
                            <span>Hacer Check-in</span>
                        </DropdownMenuItem>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                    <XCircle className="mr-2 h-4 w-4" />
                                    <span>Cancelar Reservación</span>
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción no se puede deshacer. Esto cancelará la reservación para {reservation.guestName}.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cerrar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleCancel} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        {isPending ? "Cancelando..." : "Confirmar Cancelación"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </>
                )}
                 {reservation.status === 'Checked-in' && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Check-out Anticipado</span>
                            </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Confirmar Check-out Anticipado?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta acción finalizará la estancia para {reservation.guestName}. Se aplicará la tarifa del plan seleccionado y la habitación pasará a estado de limpieza.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cerrar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleEarlyCheckOut} disabled={isPending}>
                                    {isPending ? "Procesando..." : "Confirmar Check-out"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
