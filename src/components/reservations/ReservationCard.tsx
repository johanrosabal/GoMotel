'use client';
import type { Reservation } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarClock, Clock, AlertTriangle } from 'lucide-react';
import ReservationActionsMenu from './ReservationActionsMenu';
import TimeRemaining from './TimeRemaining';
import { Progress } from '@/components/ui/progress';
import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import Link from 'next/link';

const statusColorStyles: Record<Reservation['status'], string> = {
  Confirmed: 'border-blue-500',
  'Checked-in': 'border-blue-500',
  Cancelled: 'border-red-500',
  'No-show': 'border-yellow-500',
  Completed: 'border-green-500',
};

const statusBadgeStyles: Record<Reservation['status'], string> = {
  Confirmed: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50',
  'Checked-in': 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50',
  Cancelled: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50',
  'No-show': 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/50',
  Completed: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50',
};

const statusMap: Record<Reservation['status'], string> = {
    Confirmed: 'Confirmada',
    'Checked-in': 'Checked-in',
    Cancelled: 'Cancelada',
    'No-show': 'No-show',
    Completed: 'Completada',
}

export default function ReservationCard({ reservation, isOverdue = false }: { reservation: Reservation; isOverdue?: boolean }) {
  const [progress, setProgress] = useState(0);

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
    const interval = setInterval(calculateProgress, 60000); // Update every minute
    return () => clearInterval(interval);

  }, [reservation.checkInDate, reservation.checkOutDate, reservation.status]);
  
  return (
    <Card key={reservation.id} className={cn(
        "flex flex-col relative border-l-4 hover:shadow-lg transition-shadow duration-200 h-full", 
        isOverdue ? 'border-destructive' : statusColorStyles[reservation.status],
        isOverdue && 'animate-pulse-border'
    )}>
        <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
                <div>
                    <CardTitle className="text-xl font-bold truncate" title={reservation.guestName}>
                        {reservation.guestName}
                    </CardTitle>
                    <CardDescription className="text-xs font-semibold !mt-1">
                        Hab. {reservation.roomNumber} ({reservation.roomType})
                    </CardDescription>
                </div>
                <ReservationActionsMenu reservation={reservation} className="h-7 w-7" />
            </div>
        </CardHeader>
        <CardContent className="flex-grow space-y-3 text-sm mt-4">
            <div className="flex items-start gap-2">
                <CalendarClock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                    <p className="font-semibold text-muted-foreground text-xs">Check-in</p>
                    <p className="text-xs">{format(reservation.checkInDate.toDate(), "dd MMM yyyy, h:mm a", { locale: es })}</p>
                </div>
            </div>
             <div className="flex items-start gap-2">
                <CalendarClock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                    <p className="font-semibold text-muted-foreground text-xs">Check-out</p>
                    <p className="text-xs">{format(reservation.checkOutDate.toDate(), "dd MMM yyyy, h:mm a", { locale: es })}</p>
                </div>
            </div>
            {reservation.status === 'Checked-in' && !isOverdue ? (
                <div className="space-y-1 pt-1">
                    <div className="flex justify-between items-center text-xs">
                        <p className="font-semibold text-muted-foreground">Progreso</p>
                        <TimeRemaining 
                            checkOutDate={reservation.checkOutDate.toDate()} 
                            status={reservation.status}
                            className="text-xs"
                        />
                    </div>
                    <Progress value={progress} className="h-2" />
                </div>
            ) : reservation.status !== 'Checked-in' ? (
                <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-muted-foreground text-xs">Tiempo Restante</p>
                        <TimeRemaining 
                            checkOutDate={reservation.checkOutDate.toDate()} 
                            status={reservation.status}
                            className="text-xs"
                        />
                    </div>
                </div>
            ) : null}
            {isOverdue && (
                <Button asChild variant="destructive" size="sm" className="w-full font-bold animate-pulse !mt-4">
                    <Link href={`/rooms/${reservation.roomId}`}>
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        Gestionar Estancia
                    </Link>
                </Button>
            )}
        </CardContent>
        <div className="p-6 pt-0 mt-auto flex justify-end">
             {isOverdue ? (
                <Badge variant="destructive" className="font-semibold">
                    <AlertTriangle className="h-3 w-3 mr-1.5" />
                    Vencida
                </Badge>
             ) : (
                <Badge variant="outline" className={cn('font-semibold', statusBadgeStyles[reservation.status])}>
                    {statusMap[reservation.status]}
                </Badge>
             )}
        </div>
    </Card>
  );
}
