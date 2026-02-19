'use client';

import { useTransition, useState } from 'react';
import type { Reservation } from '@/types';
import Link from 'next/link';
import { MoreHorizontal, LogIn, XCircle, UserX, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { checkInFromReservation, cancelReservation, markAsNoShow, deleteReservation } from '@/lib/actions/reservation.actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useUserProfile } from '@/hooks/use-user-profile';

export default function ReservationActionsMenu({ reservation, className }: { reservation: Reservation, className?: string }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [isCancelAlertOpen, setIsCancelAlertOpen] = useState(false);
    const [isNoShowAlertOpen, setIsNoShowAlertOpen] = useState(false);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const { userProfile } = useUserProfile();

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
        setIsCancelAlertOpen(false);
        startTransition(async () => {
            const result = await cancelReservation(reservation.id);
            if (result?.error) {
                toast({ title: 'Error', description: 'No se pudo cancelar la reservación.', variant: 'destructive' });
            } else {
                toast({ title: 'Reservación Cancelada', description: 'La reservación ha sido cancelada.' });
            }
        });
    }
    
    const handleNoShow = () => {
        setIsNoShowAlertOpen(false);
        startTransition(async () => {
            const result = await markAsNoShow(reservation.id);
            if (result?.error) {
                toast({ title: 'Error', description: 'No se pudo anular la reservación.', variant: 'destructive' });
            } else {
                toast({ title: 'Reservación Anulada', description: 'La reservación ha sido marcada como No-show.' });
            }
        });
    }

    const handleDelete = () => {
        setIsDeleteAlertOpen(false);
        startTransition(async () => {
            const result = await deleteReservation(reservation.id);
            if (result?.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Reservación Eliminada', description: 'La reservación ha sido eliminada permanentemente.' });
            }
        });
    };

    return (
        <>
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
                            <DropdownMenuItem onSelect={() => setIsCancelAlertOpen(true)} className="text-destructive focus:text-destructive">
                                <XCircle className="mr-2 h-4 w-4" />
                                <span>Cancelar Reservación</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setIsNoShowAlertOpen(true)} className="text-destructive focus:text-destructive">
                                <UserX className="mr-2 h-4 w-4" />
                                <span>Anular (No-show)</span>
                            </DropdownMenuItem>
                        </>
                    )}
                    {reservation.status === 'Checked-in' && (
                         <DropdownMenuItem asChild>
                            <Link href={`/rooms/${reservation.roomId}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                <span>Gestionar Estancia</span>
                            </Link>
                        </DropdownMenuItem>
                    )}
                    {userProfile?.role === 'Administrador' && reservation.status !== 'Checked-in' && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setIsDeleteAlertOpen(true)} className="text-destructive focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar (Admin)
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={isCancelAlertOpen} onOpenChange={setIsCancelAlertOpen}>
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
            
            <AlertDialog open={isNoShowAlertOpen} onOpenChange={setIsNoShowAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Marcar como No-show?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Esto anulará la reservación para {reservation.guestName} por no presentarse.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cerrar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleNoShow} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isPending ? "Anulando..." : "Confirmar Anulación"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Esto eliminará permanentemente la reservación para {reservation.guestName}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cerrar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isPending ? "Eliminando..." : "Confirmar Eliminación"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
