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
import CheckInFromReservationDialog from './CheckInFromReservationDialog';

export default function ReservationActionsMenu({ reservation, className }: { reservation: Reservation, className?: string }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [isCancelAlertOpen, setIsCancelAlertOpen] = useState(false);
    const [isNoShowAlertOpen, setIsNoShowAlertOpen] = useState(false);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const { userProfile } = useUserProfile();

    const handleCheckIn = () => {
        startTransition(async () => {
            const userName = userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Sistema';
            const result = await checkInFromReservation(reservation.id, undefined, userName);
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
                toast({ title: 'Reservación Anulada', description: 'La reservación ha sido marcada como "No se presentó".' });
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
                    <Button aria-haspopup="true" size="icon" variant="ghost" disabled={isPending} className={className} id="reservationactionsmenu-button-1" data-testid="reservationactionsmenu-action-button">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-slate-950/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)] min-w-[180px]">
                    <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-3 py-2">Acciones</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/5 mx-1" />
                    {reservation.status === 'Confirmed' && (
                        <>
                            {reservation.paymentStatus === 'Pagado' ? (
                                <DropdownMenuItem onClick={handleCheckIn} disabled={isPending} className="py-2.5 px-3 rounded-xl text-slate-200 focus:bg-white/5 focus:text-white font-bold transition-all cursor-pointer flex items-center gap-2">
                                    <LogIn className="h-4 w-4 text-emerald-500" />
                                    <span>Hacer Check-in</span>
                                </DropdownMenuItem>
                            ) : (
                                <CheckInFromReservationDialog reservation={reservation}>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="py-2.5 px-3 rounded-xl text-slate-200 focus:bg-white/5 focus:text-white font-bold transition-all cursor-pointer flex items-center gap-2">
                                        <LogIn className="h-4 w-4 text-emerald-500" />
                                        <span>Hacer Check-in</span>
                                    </DropdownMenuItem>
                                </CheckInFromReservationDialog>
                            )}
                            <DropdownMenuItem onSelect={() => setIsCancelAlertOpen(true)} className="py-2.5 px-3 rounded-xl text-rose-500 focus:bg-rose-500/10 focus:text-rose-400 font-bold transition-all cursor-pointer flex items-center gap-2">
                                <XCircle className="h-4 w-4" />
                                <span>Cancelar Reservación</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setIsNoShowAlertOpen(true)} className="py-2.5 px-3 rounded-xl text-orange-500 focus:bg-orange-500/10 focus:text-orange-400 font-bold transition-all cursor-pointer flex items-center gap-2">
                                <UserX className="h-4 w-4" />
                                <span>Anular (No se presentó)</span>
                            </DropdownMenuItem>
                        </>
                    )}
                    {reservation.status === 'Checked-in' && (
                        <DropdownMenuItem asChild>
                            <Link href={`/rooms/${reservation.roomId}`} id="reservationactionsmenu-link-1" data-testid="reservationactionsmenu-action-manage-link" className="py-2.5 px-3 rounded-xl text-slate-200 focus:bg-white/5 focus:text-white font-bold transition-all cursor-pointer flex items-center gap-2">
                                <Eye className="h-4 w-4 text-primary" />
                                <span>Gestionar Estancia</span>
                            </Link>
                        </DropdownMenuItem>
                    )}
                    {userProfile?.role === 'Administrador' && reservation.status !== 'Checked-in' && (
                        <>
                            <DropdownMenuSeparator className="bg-white/5 mx-1" />
                            <DropdownMenuItem onSelect={() => setIsDeleteAlertOpen(true)} className="py-2.5 px-3 rounded-xl text-rose-600 focus:bg-rose-600/10 focus:text-rose-500 font-bold transition-all cursor-pointer flex items-center gap-2">
                                <Trash2 className="h-4 w-4" />
                                <span>Eliminar (Admin)</span>
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
                        <AlertDialogTitle>¿Marcar como "No se presentó"?</AlertDialogTitle>
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
