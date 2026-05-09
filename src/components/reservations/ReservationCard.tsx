'use client';
import type { Reservation } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarClock, LogIn, AlertTriangle, Ban, ChevronRight, UserX, XCircle, Loader2 } from 'lucide-react';
import ReservationActionsMenu from './ReservationActionsMenu';
import TimeRemaining from './TimeRemaining';
import CheckInFromReservationDialog from './CheckInFromReservationDialog';
import { Progress } from '@/components/ui/progress';
import { useState, useEffect, useTransition } from 'react';
import { Button } from '../ui/button';
import Link from 'next/link';
import { checkInFromReservation, markAsNoShow, cancelReservation } from '@/lib/actions/reservation.actions';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';

const statusColorStyles: Record<Reservation['status'], string> = {
    Confirmed: 'border-blue-500/50 shadow-blue-500/10',
    'Checked-in': 'border-emerald-500/50 shadow-emerald-500/10',
    Cancelled: 'border-rose-500/50 shadow-rose-500/10',
    'No-show': 'border-amber-500/50 shadow-amber-500/10',
    Completed: 'border-slate-500/50 shadow-slate-500/10',
};

import InvoiceSuccessDialog from './InvoiceSuccessDialog';
import { useFirebase } from '@/firebase';

const statusBadgeStyles: Record<Reservation['status'], string> = {
    Confirmed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Checked-in': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    'No-show': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Completed: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const statusMap: Record<Reservation['status'], string> = {
    Confirmed: 'Confirmada',
    'Checked-in': 'En Estancia',
    Cancelled: 'Cancelada',
    'No-show': 'No se presentó',
    Completed: 'Completada',
}

interface ProcessedReservation extends Reservation {
    isOverdue?: boolean;
    isArrivalOverdue?: boolean;
}

export default function ReservationCard({ reservation, isOverdue = false }: { reservation: ProcessedReservation; isOverdue?: boolean }) {
    const [progress, setProgress] = useState(0);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [isCancelAlertOpen, setIsCancelAlertOpen] = useState(false);
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [invoiceId, setInvoiceId] = useState<string | null>(null);
    const { user } = useFirebase();

    useEffect(() => {
        if (reservation.status !== 'Checked-in') {
            setProgress(0);
            return;
        }

        const calculateProgress = () => {
            const now = new Date();
            const checkInTime = reservation.checkInDate.toDate();
            const expectedCheckOutTime = reservation.checkOutDate.toDate();

            if (now >= expectedCheckOutTime) {
                setProgress(100);
                return;
            }
            if (now < checkInTime) {
                setProgress(0);
                return;
            }

            const totalDuration = expectedCheckOutTime.getTime() - checkInTime.getTime();
            const elapsedTime = now.getTime() - checkInTime.getTime();

            const calculatedProgress = (elapsedTime / totalDuration) * 100;
            setProgress(Math.min(100, calculatedProgress));
        };

        calculateProgress();
        const interval = setInterval(calculateProgress, 60000);
        return () => clearInterval(interval);

    }, [reservation.checkInDate, reservation.checkOutDate, reservation.status]);

    const handleQuickCheckIn = (e: React.MouseEvent) => {
        e.preventDefault();
        startTransition(async () => {
            const result = await checkInFromReservation(reservation.id, undefined, user?.displayName || user?.email || 'Sistema');
            if (result?.error) {
                toast({ title: 'Error en Check-in', description: result.error, variant: 'destructive' });
            } else {
                if (result?.invoiceId) {
                    setInvoiceId(result.invoiceId);
                    setTimeout(() => setSuccessModalOpen(true), 200);
                } else {
                    toast({ title: 'Check-in Exitoso', description: `¡Huésped ${reservation.guestName} registrado!` });
                }
            }
        });
    };

    const handleMarkAsNoShow = (e: React.MouseEvent) => {
        e.preventDefault();
        startTransition(async () => {
            const result = await markAsNoShow(reservation.id);
            if (result?.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Liberado', description: `La reservación de ${reservation.guestName} se marcó como 'No se presentó'.` });
            }
        });
    };

    const handleCancelConfirm = () => {
        setIsCancelAlertOpen(false);
        startTransition(async () => {
            const result = await cancelReservation(reservation.id);
            if (result?.error) {
                toast({ title: 'Error', description: 'No se pudo cancelar la reservación.', variant: 'destructive' });
            } else {
                toast({ title: 'Reservación Cancelada', description: 'La reservación ha sido liberada exitosamente.' });
            }
        });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
        e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
    };

    const isFinalState = ['Completed', 'Cancelled', 'No-show'].includes(reservation.status);
    const isArrivalOverdue = reservation.isArrivalOverdue;

    return (
        <>
            <Card
                key={reservation.id}
                id={`reservation-card-${reservation.id}`}
                className={cn(
                    "flex flex-col relative transition-all duration-500 h-full group bg-slate-900/40 backdrop-blur-2xl border-white/5 rounded-[2rem] overflow-hidden shadow-2xl",
                    "hover:scale-[1.01] hover:bg-slate-900/60 hover:shadow-black/50 hover:border-white/10",
                    isOverdue || isArrivalOverdue ? 'ring-1 ring-rose-500/30 bg-rose-500/[0.02]' : 'ring-1 ring-white/5'
                )}
                onMouseMove={handleMouseMove}
            >
                {/* Status Accent Bar */}
                <div className={cn(
                    "absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-500",
                    isArrivalOverdue || isOverdue ? 'bg-rose-500' : 
                    reservation.status === 'Confirmed' ? 'bg-blue-500' :
                    reservation.status === 'Checked-in' ? 'bg-emerald-500' : 'bg-slate-500'
                )} />

                {/* Spotlight Effect */}
                <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0"
                    style={{
                        background: `radial-gradient(400px circle at var(--mouse-x, 0) var(--mouse-y, 0), rgba(255,255,255,0.03), transparent 60%)`
                    }}
                />

                <CardHeader className="pb-4 pt-7 px-7 relative z-10">
                    <div className="flex items-start justify-between">
                        <div className="space-y-4 flex-1 min-w-0">
                            <div className="space-y-1">
                                <CardTitle className="text-2xl font-black uppercase italic tracking-tighter leading-none text-white group-hover:text-primary transition-colors truncate" title={reservation.guestName}>
                                    {reservation.guestName}
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em]">
                                        {reservation.roomType}
                                    </p>
                                    <div className="h-1 w-1 rounded-full bg-slate-700" />
                                    <span className="text-[10px] font-bold text-primary italic">Hab. {reservation.roomNumber}</span>
                                </div>
                            </div>
                        </div>
                        <div className="shrink-0">
                            <ReservationActionsMenu reservation={reservation} className="h-10 w-10 bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all rounded-2xl" />
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="flex-grow px-7 space-y-6 relative z-10">
                    {!isFinalState ? (
                        <div className={cn(
                            "grid grid-cols-2 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5",
                            isArrivalOverdue && "bg-rose-500/10 border-rose-500/20"
                        )}>
                            <div className="bg-slate-950/40 p-4 space-y-1">
                                <p className={cn(
                                    "text-[8px] font-black uppercase tracking-[0.2em] flex items-center gap-2",
                                    isArrivalOverdue ? "text-rose-500" : "text-slate-500"
                                )}>
                                    <CalendarClock className="w-3 h-3" /> Entrada
                                </p>
                                <p className={cn("font-black text-xs text-slate-100", isArrivalOverdue && "text-rose-200")}>
                                    {format(reservation.checkInDate.toDate(), "dd MMM, h:mm a", { locale: es })}
                                </p>
                            </div>
                            <div className="bg-slate-950/40 p-4 space-y-1 text-right border-l border-white/5">
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 justify-end">
                                    Salida <CalendarClock className="w-3 h-3" />
                                </p>
                                <p className="font-black text-xs text-slate-100">{format(reservation.checkOutDate.toDate(), "dd MMM, h:mm a", { locale: es })}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 bg-white/[0.02] rounded-2xl border border-dashed border-white/5 text-[9px] text-slate-600 font-black uppercase tracking-[0.3em]">
                            <Ban className="w-5 h-5 mb-2 opacity-20" />
                            Sesión Finalizada
                        </div>
                    )}

                    {reservation.status === 'Checked-in' && !isOverdue && (
                        <div className="space-y-3 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Progreso Estancia</span>
                                <TimeRemaining
                                    checkOutDate={reservation.checkOutDate.toDate()}
                                    status={reservation.status}
                                    className="text-[9px] font-black uppercase tracking-widest text-primary"
                                />
                            </div>
                            <Progress value={progress} className="h-2 bg-slate-950" />
                        </div>
                    )}

                    {/* Quick Action Area */}
                    <div className="space-y-3 pt-2">
                        {reservation.status === 'Confirmed' && !isArrivalOverdue && (
                            reservation.paymentStatus === 'Pagado' ? (
                                <Button
                                    onClick={handleQuickCheckIn}
                                    disabled={isPending}
                                    className="w-full h-14 rounded-2xl bg-white text-black hover:bg-primary hover:text-black font-black text-[11px] uppercase tracking-[0.2em] shadow-xl transition-all group-hover:translate-y-[-2px] active:translate-y-0" id="reservationcard-button-1" data-testid="reservationcard-action-checkin-button"
                                >
                                    {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                                        <>
                                            <LogIn className="mr-2 h-5 w-5" />
                                            Completar Ingreso
                                        </>
                                    )}
                                </Button>
                            ) : (
                                <CheckInFromReservationDialog 
                                    reservation={reservation}
                                    onCheckInSuccess={(id) => {
                                        if (id) {
                                            setInvoiceId(id);
                                            setTimeout(() => setSuccessModalOpen(true), 200);
                                        } else {
                                            toast({ title: '¡Éxito!', description: `El ingreso de ${reservation.guestName} se ha registrado.` });
                                        }
                                    }}
                                >
                                    <Button
                                        disabled={isPending}
                                        className="w-full h-14 rounded-2xl bg-white text-black hover:bg-primary hover:text-black font-black text-[11px] uppercase tracking-[0.2em] shadow-xl transition-all group-hover:translate-y-[-2px] active:translate-y-0" id="reservationcard-button-1" data-testid="reservationcard-action-checkin-button"
                                    >
                                        <LogIn className="mr-2 h-5 w-5" />
                                        Hacer Check-in
                                    </Button>
                                </CheckInFromReservationDialog>
                            )
                        )}

                        {isArrivalOverdue && (
                            <div className="grid grid-cols-1 gap-3">
                                {reservation.paymentStatus === 'Pagado' ? (
                                    <Button
                                        onClick={handleQuickCheckIn}
                                        disabled={isPending}
                                        className="h-14 rounded-2xl bg-white text-black hover:bg-primary font-black text-[11px] uppercase tracking-[0.2em] shadow-xl transition-all group-hover:translate-y-[-2px] active:translate-y-0" id="reservationcard-button-ingresar" data-testid="reservationcard-action-checkin-button"
                                    >
                                        Ingresar Huésped
                                    </Button>
                                ) : (
                                    <CheckInFromReservationDialog 
                                        reservation={reservation}
                                        onCheckInSuccess={(id) => {
                                            if (id) {
                                                setInvoiceId(id);
                                                setTimeout(() => setSuccessModalOpen(true), 200);
                                            } else {
                                                toast({ title: '¡Éxito!', description: `El ingreso de ${reservation.guestName} se ha registrado.` });
                                            }
                                        }}
                                    >
                                        <Button
                                            disabled={isPending}
                                            className="h-14 rounded-2xl bg-white text-black hover:bg-primary font-black text-[11px] uppercase tracking-[0.2em] shadow-xl transition-all group-hover:translate-y-[-2px] active:translate-y-0" id="reservationcard-button-ingresar" data-testid="reservationcard-action-checkin-button"
                                        >
                                            Ingresar con Pago
                                        </Button>
                                    </CheckInFromReservationDialog>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={handleMarkAsNoShow}
                                        disabled={isPending}
                                        className="h-12 rounded-xl border-white/5 bg-white/5 hover:bg-rose-500 hover:text-white font-black text-[9px] uppercase tracking-[0.2em] transition-all" id="reservationcard-button-no-lleg" data-testid="reservationcard-action-noshow-button"
                                    >
                                        <UserX className="mr-2 h-4 w-4" /> No llegó
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={(e) => { e.preventDefault(); setIsCancelAlertOpen(true); }}
                                        disabled={isPending}
                                        className="h-12 rounded-xl border-white/5 bg-white/5 hover:bg-rose-500 hover:text-white font-black text-[9px] uppercase tracking-[0.2em] transition-all" id="reservationcard-button-cancelar-reservaci-n" data-testid="reservationcard-cancel-button"
                                    >
                                        <XCircle className="mr-2 h-4 w-4" /> Cancelar
                                    </Button>
                                </div>
                            </div>
                        )}

                        {reservation.status === 'Checked-in' && !isOverdue && (
                            <Button asChild variant="secondary" className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-primary hover:text-black font-black text-[11px] uppercase tracking-[0.2em] transition-all group-hover:translate-y-[-2px] active:translate-y-0" id="reservationcard-button-2" data-testid="reservationcard-action-manage-button">
                                <Link href={`/rooms/${reservation.roomId}`} id="reservationcard-link-gestionar-estancia" data-testid="reservationcard-next-link">
                                    Gestionar Habitación <ChevronRight className="ml-2 h-5 w-5" />
                                </Link>
                            </Button>
                        )}
                        {isOverdue && reservation.status === 'Checked-in' && (
                            <Button asChild variant="destructive" className="w-full h-14 rounded-2xl bg-rose-600 hover:bg-rose-700 font-black text-[11px] uppercase tracking-[0.2em] shadow-rose-500/40 shadow-2xl transition-all group-hover:translate-y-[-2px] active:translate-y-0 animate-pulse" id="reservationcard-button-3" data-testid="reservationcard-action-checkout-button">
                                <Link href={`/rooms/${reservation.roomId}`} id="reservationcard-link-check-out-pendiente" data-testid="reservationcard-action-link">
                                    <AlertTriangle className="mr-2 h-5 w-5" />
                                    Check-out Vencido
                                </Link>
                            </Button>
                        )}
                    </div>
                </CardContent>

                <div className="px-7 pb-7 pt-4 mt-auto flex justify-between items-center relative z-10 bg-slate-950/20 backdrop-blur-md border-t border-white/5">
                    <Badge variant="outline" className={cn(
                        'font-black text-[8px] uppercase tracking-[0.3em] px-5 py-2 rounded-full border-none shadow-inner',
                        isArrivalOverdue || isOverdue ? 'bg-rose-500 text-white' : statusBadgeStyles[reservation.status]
                    )}>
                        {isArrivalOverdue ? 'Retraso Crítico' : isOverdue ? 'Estancia Vencida' : statusMap[reservation.status]}
                    </Badge>

                    {reservation.guestId && (
                        <div className="flex items-center gap-2 text-[8px] font-black text-slate-500 tracking-[0.2em] uppercase opacity-60">
                            Validado
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        </div>
                    )}
                </div>
            </Card>

            <AlertDialog open={isCancelAlertOpen} onOpenChange={setIsCancelAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Confirmar cancelación?</AlertDialogTitle>
                        <AlertDialogDescription>
                            La reservación de {reservation.guestName} para la habitación {reservation.roomNumber} será cancelada y la habitación quedará libre.
                            {reservation.paymentAmount && reservation.paymentAmount > 0 ? (
                                <p className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded text-xs font-bold">
                                    AVISO: Existe un pago previo de {formatCurrency(reservation.paymentAmount)}.
                                </p>
                            ) : null}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cerrar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancelConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Cancelar Reservación
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <InvoiceSuccessDialog 
                open={successModalOpen} 
                onOpenChange={setSuccessModalOpen} 
                invoiceId={invoiceId} 
            />
        </>
    );
}
