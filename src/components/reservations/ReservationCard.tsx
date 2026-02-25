'use client';
import type { Reservation } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarClock, LogIn, AlertTriangle, Ban, ChevronRight } from 'lucide-react';
import ReservationActionsMenu from './ReservationActionsMenu';
import TimeRemaining from './TimeRemaining';
import { Progress } from '@/components/ui/progress';
import { useState, useEffect, useTransition } from 'react';
import { Button } from '../ui/button';
import Link from 'next/link';
import { checkInFromReservation } from '@/lib/actions/reservation.actions';
import { useToast } from '@/hooks/use-toast';

const statusColorStyles: Record<Reservation['status'], string> = {
  Confirmed: 'border-blue-500',
  'Checked-in': 'border-green-500',
  Cancelled: 'border-red-500',
  'No-show': 'border-yellow-500',
  Completed: 'border-gray-500',
};

const statusBadgeStyles: Record<Reservation['status'], string> = {
  Confirmed: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50',
  'Checked-in': 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50',
  Cancelled: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50',
  'No-show': 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/50',
  Completed: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800/50',
};

const statusMap: Record<Reservation['status'], string> = {
    Confirmed: 'Confirmada',
    'Checked-in': 'En Estancia',
    Cancelled: 'Cancelada',
    'No-show': 'No se presentó',
    Completed: 'Completada',
}

export default function ReservationCard({ reservation, isOverdue = false }: { reservation: Reservation; isOverdue?: boolean }) {
  const [progress, setProgress] = useState(0);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

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

  const isFinalState = ['Completed', 'Cancelled', 'No-show'].includes(reservation.status);

  return (
    <Card key={reservation.id} className={cn(
        "flex flex-col relative border-l-[6px] hover:shadow-xl transition-all duration-300 h-full group", 
        isOverdue ? 'border-destructive' : statusColorStyles[reservation.status],
        isOverdue && 'animate-overdue-pulse'
    )}>
        <CardHeader className="pb-3 pt-5">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <CardTitle className="text-xl font-black tracking-tight truncate leading-none" title={reservation.guestName}>
                        {reservation.guestName}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-bold text-[10px] uppercase tracking-wider">
                            Hab. {reservation.roomNumber}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase">{reservation.roomType}</span>
                    </div>
                </div>
                <ReservationActionsMenu reservation={reservation} className="h-8 w-8 -mt-1 -mr-1" />
            </div>
        </CardHeader>
        <CardContent className="flex-grow space-y-4 text-sm">
            {!isFinalState ? (
                <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-lg border border-border/50">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" /> Entrada
                        </p>
                        <p className="font-bold text-xs">{format(reservation.checkInDate.toDate(), "dd MMM, h:mm a", { locale: es })}</p>
                    </div>
                    <div className="space-y-1 text-right">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter flex items-center gap-1 justify-end">
                            Salida <CalendarClock className="w-3 h-3" />
                        </p>
                        <p className="font-bold text-xs">{format(reservation.checkOutDate.toDate(), "dd MMM, h:mm a", { locale: es })}</p>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-center p-4 bg-muted/20 rounded-lg border border-dashed text-xs text-muted-foreground font-medium">
                    <Ban className="w-4 h-4 mr-2" />
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
            <div className="pt-2">
                {reservation.status === 'Confirmed' && (
                    <Button 
                        onClick={handleQuickCheckIn} 
                        disabled={isPending}
                        className="w-full h-11 font-black text-xs uppercase tracking-[0.1em] shadow-lg group-hover:scale-[1.02] transition-transform"
                    >
                        {isPending ? 'Procesando...' : (
                            <>
                                <LogIn className="mr-2 h-4 w-4" /> 
                                Registrar Ingreso (Check-in)
                            </>
                        )}
                    </Button>
                )}
                {reservation.status === 'Checked-in' && (
                    <Button asChild variant="secondary" className="w-full h-11 font-black text-xs uppercase tracking-[0.1em] border border-primary/20">
                        <Link href={`/rooms/${reservation.roomId}`}>
                            Gestionar Habitación <ChevronRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                )}
                {isOverdue && (
                    <Button asChild variant="destructive" className="w-full h-11 font-black text-xs uppercase tracking-[0.1em] animate-pulse shadow-red-500/20 shadow-lg">
                        <Link href={`/rooms/${reservation.roomId}`}>
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            Check-out Pendiente
                        </Link>
                    </Button>
                )}
            </div>
        </CardContent>
        <div className="px-6 pb-5 mt-auto flex justify-between items-center">
             {isOverdue ? (
                <Badge variant="destructive" className="font-black text-[10px] uppercase tracking-widest px-3 py-1 ring-4 ring-destructive/10">
                    Estancia Vencida
                </Badge>
             ) : (
                <Badge variant="outline" className={cn('font-black text-[10px] uppercase tracking-widest px-3 py-1', statusBadgeStyles[reservation.status])}>
                    {statusMap[reservation.status]}
                </Badge>
             )}
             
             {reservation.guestId && (
                 <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground opacity-60">
                     CLIENTE REGISTRADO
                 </div>
             )}
        </div>
    </Card>
  );
}
