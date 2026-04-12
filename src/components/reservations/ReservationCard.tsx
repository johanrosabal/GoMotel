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
            const result = await checkInFromReservation(reservation.id);
            if (result?.error) {
                toast({ title: 'Error en Check-in', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Check-in Exitoso', description: `¡Huésped ${reservation.guestName} registrado!` });
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
                    "flex flex-col relative border-t-0 border-r-0 border-b-0 border-l-[6px] transition-all duration-500 h-full group bg-white/5 backdrop-blur-md border-white/5 rounded-[2.5rem] overflow-hidden",
                    "hover:scale-[1.02] hover:bg-white/[0.08] hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]",
                    isOverdue ? 'border-rose-500 shadow-rose-500/20 hover:shadow-rose-500/30 shadow-[0_0_20px_rgba(251,113,133,0.3)]' : cn(statusColorStyles[reservation.status], "hover:border-opacity-100")
                )}
                onMouseMove={handleMouseMove}
            >
                {/* Dynamic Spotlight Effect */}
                <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0"
                    style={{
                        background: `radial-gradient(600px circle at var(--mouse-x, 0) var(--mouse-y, 0), rgba(255,255,255,0.06), transparent 40%)`
                    }}
                />

                {/* Hover Highlight Overlay (Static fallback/enhancement) */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <CardHeader className="pb-4 pt-6 relative z-10">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-4 flex-1 min-w-0">
                            <CardTitle className="text-xl font-black uppercase italic tracking-tighter leading-tight text-white group-hover:text-primary transition-colors pr-8 break-words" title={reservation.guestName}>
                                {reservation.guestName}
                            </CardTitle>
                            <div className="space-y-2">
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest italic leading-none">
                                    {reservation.roomType}
                                </p>
                                <Badge variant="outline" className="font-black text-[9px] uppercase tracking-widest bg-white/5 border-white/10 text-slate-300 rounded-lg h-5 px-2 w-fit">
                                    Hab. {reservation.roomNumber}
                                </Badge>
                            </div>
                        </div>
                        <div className="absolute right-6 top-6">
                            <ReservationActionsMenu reservation={reservation} className="h-9 w-9 bg-white/5 border border-white/10 hover:bg-primary/20 hover:text-primary transition-all rounded-xl shrink-0" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-grow space-y-5 text-sm relative z-10">
                    {!isFinalState ? (
                        <div className={cn(
                            "grid grid-cols-2 gap-4 p-4 rounded-2xl border border-white/5 transition-colors",
                            isArrivalOverdue ? "bg-rose-500/10 border-rose-500/20" : "bg-black/20"
                        )}>
                            <div className="space-y-1.5">
                                <p className={cn(
                                    "text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5",
                                    isArrivalOverdue ? "text-rose-500" : "text-slate-500"
                                )}>
                                    <CalendarClock className="w-3.5 h-3.5" /> Entrada
                                </p>
                                <p className={cn("font-black text-xs text-white", isArrivalOverdue && "text-rose-200")}>
                                    {format(reservation.checkInDate.toDate(), "dd MMM, h:mm a", { locale: es })}
                                </p>
                            </div>
                            <div className="space-y-1.5 text-right">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 justify-end">
                                    Salida <CalendarClock className="w-3.5 h-3.5" />
                                </p>
                                <p className="font-black text-xs text-white">{format(reservation.checkOutDate.toDate(), "dd MMM, h:mm a", { locale: es })}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center p-6 bg-white/2 rounded-2xl border border-dashed border-white/10 text-[10px] text-slate-500 font-black uppercase tracking-widest italic transition-opacity">
                            <Ban className="w-4 h-4 mr-2 opacity-50" />
                            Estancia finalizada
                        </div>
                    )}

                    {reservation.status === 'Checked-in' && !isOverdue && (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-widest text-primary">
                                <span>Progreso de Estancia</span>
                                <TimeRemaining
                                    checkOutDate={reservation.checkOutDate.toDate()}
                                    status={reservation.status}
                                />
                            </div>
                            <Progress value={progress} className="h-2.5 shadow-inner" />
                        </div>
                    )}

                    {/* Quick Action Area */}
                    <div className="pt-3">
                        {reservation.status === 'Confirmed' && !isArrivalOverdue && (
                            <Button
                                onClick={handleQuickCheckIn}
                                disabled={isPending}
                                className="w-full h-12 rounded-2xl bg-white text-black hover:bg-primary hover:text-black font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all group-hover:scale-[1.02]" id="reservationcard-button-1" data-testid="reservationcard-action-checkin-button"
                            >
                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                                    <>
                                        <LogIn className="mr-2 h-4 w-4" />
                                        Hacer Check-in
                                    </>
                                )}
                            </Button>
                        )}

                        {isArrivalOverdue && (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        onClick={handleQuickCheckIn}
                                        disabled={isPending}
                                        className="h-12 rounded-2xl bg-white text-black hover:bg-primary font-black text-[10px] uppercase tracking-widest shadow-xl transition-all" id="reservationcard-button-ingresar" data-testid="reservationcard-action-checkin-button"
                                    >
                                        Ingresar
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={handleMarkAsNoShow}
                                        disabled={isPending}
                                        className="h-12 rounded-2xl bg-rose-600 hover:bg-rose-700 font-black text-[10px] uppercase tracking-widest shadow-xl transition-all" id="reservationcard-button-no-lleg" data-testid="reservationcard-action-noshow-button"
                                    >
                                        <UserX className="mr-2 h-4 w-4" /> No llegó
                                    </Button>
                                </div>
                                <Button
                                    variant="ghost"
                                    onClick={(e) => { e.preventDefault(); setIsCancelAlertOpen(true); }}
                                    disabled={isPending}
                                    className="w-full h-10 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] text-rose-500 hover:text-white hover:bg-rose-500/20 border border-rose-500/10 transition-all" id="reservationcard-button-cancelar-reservaci-n" data-testid="reservationcard-cancel-button"
                                >
                                    <XCircle className="mr-2 h-4 w-4" /> Cancelar Reservación
                                </Button>
                            </div>
                        )}

                        {reservation.status === 'Checked-in' && !isOverdue && (
                            <Button asChild variant="secondary" className="w-full h-12 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-primary hover:text-black font-black text-[10px] uppercase tracking-[0.2em] transition-all" id="reservationcard-button-2" data-testid="reservationcard-action-manage-button">
                                <Link href={`/rooms/${reservation.roomId}`} id="reservationcard-link-gestionar-estancia" data-testid="reservationcard-next-link">
                                    Gestionar Estancia <ChevronRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        )}
                        {isOverdue && reservation.status === 'Checked-in' && (
                            <Button asChild variant="destructive" className="w-full h-12 rounded-2xl bg-rose-600 hover:bg-rose-700 font-black text-[10px] uppercase tracking-[0.2em] shadow-rose-500/30 shadow-2xl transition-all" id="reservationcard-button-3" data-testid="reservationcard-action-checkout-button">
                                <Link href={`/rooms/${reservation.roomId}`} id="reservationcard-link-check-out-pendiente" data-testid="reservationcard-action-link">
                                    <AlertTriangle className="mr-2 h-4 w-4" />
                                    Check-out Pendiente
                                </Link>
                            </Button>
                        )}
                    </div>
                </CardContent>
                <div className="px-6 pb-6 pt-2 mt-auto flex justify-between items-center relative z-10 border-t border-white/5">
                    <Badge variant="outline" className={cn(
                        'font-black text-[9px] uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border shadow-lg',
                        isArrivalOverdue || isOverdue ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : statusBadgeStyles[reservation.status]
                    )}>
                        {isArrivalOverdue ? 'Cliente no llegó' : isOverdue ? 'Estancia Vencida' : statusMap[reservation.status]}
                    </Badge>

                    {reservation.guestId && (
                        <div className="flex items-center gap-2 text-[8px] font-black text-slate-500 tracking-[0.2em] uppercase opacity-40 text-right">
                            Huésped Validado
                            <div className="h-1 w-1 rounded-full bg-slate-500" />
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
        </>
    );
}
