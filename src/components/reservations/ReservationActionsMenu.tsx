'use client';

import { useTransition, useState } from 'react';
import type { Reservation } from '@/types';
import { MoreHorizontal, LogIn, XCircle, LogOut, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { checkInFromReservation, cancelReservation, checkOutEarlyFromReservation, markAsNoShow } from '@/lib/actions/reservation.actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function ReservationActionsMenu({ reservation, className }: { reservation: Reservation, className?: string }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [isCancelAlertOpen, setIsCancelAlertOpen] = useState(false);
    const [isCheckoutAlertOpen, setIsCheckoutAlertOpen] = useState(false);
    const [isNoShowAlertOpen, setIsNoShowAlertOpen] = useState(false);
    const [checkoutReason, setCheckoutReason] = useState('');
    const [checkoutNotes, setCheckoutNotes] = useState('');

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
            setIsCancelAlertOpen(false);
        });
    }
    
    const handleNoShow = () => {
        startTransition(async () => {
            const result = await markAsNoShow(reservation.id);
            if (result?.error) {
                toast({ title: 'Error', description: 'No se pudo anular la reservación.', variant: 'destructive' });
            } else {
                toast({ title: 'Reservación Anulada', description: 'La reservación ha sido marcada como No-show.' });
            }
            setIsNoShowAlertOpen(false);
        });
    }

    const handleEarlyCheckOut = () => {
        if (!checkoutReason) {
            toast({
                title: 'Error',
                description: 'Por favor, seleccione un motivo para el check-out.',
                variant: 'destructive'
            });
            return;
        }

        startTransition(async () => {
            const result = await checkOutEarlyFromReservation(reservation.id, checkoutReason, checkoutNotes);
            if (result?.error) {
                toast({ title: 'Error en Check-out', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: '¡Check-out Exitoso!', description: `${reservation.guestName} ha finalizado su estancia.` });
            }
            setIsCheckoutAlertOpen(false);
            setCheckoutReason('');
            setCheckoutNotes('');
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
                        <DropdownMenuItem onSelect={() => setIsCheckoutAlertOpen(true)}>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Check-out Anticipado</span>
                        </DropdownMenuItem>
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

            <AlertDialog open={isCheckoutAlertOpen} onOpenChange={setIsCheckoutAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Confirmar Check-out Anticipado?</AlertDialogTitle>
                        <AlertDialogDescription>
                           Se aplicará la tarifa del plan seleccionado y la habitación pasará a estado de limpieza. Por favor, especifique el motivo del retiro.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="checkout-reason">Motivo del Retiro</Label>
                            <Select value={checkoutReason} onValueChange={setCheckoutReason}>
                                <SelectTrigger id="checkout-reason">
                                    <SelectValue placeholder="Seleccione un motivo..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Salida voluntaria">Salida voluntaria del cliente</SelectItem>
                                    <SelectItem value="Incumplimiento de normas">Incumplimiento de normas</SelectItem>
                                    <SelectItem value="Daños a la propiedad">Daños a la propiedad</SelectItem>
                                    <SelectItem value="Emergencia">Emergencia del cliente</SelectItem>
                                    <SelectItem value="Otro">Otro (especificar en notas)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="checkout-notes">Notas Adicionales</Label>
                            <Textarea 
                                id="checkout-notes"
                                placeholder="Detalles sobre el motivo del retiro..."
                                value={checkoutNotes}
                                onChange={(e) => setCheckoutNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => { setCheckoutReason(''); setCheckoutNotes(''); }}>Cerrar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleEarlyCheckOut} disabled={isPending || !checkoutReason}>
                            {isPending ? "Procesando..." : "Confirmar Check-out"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
