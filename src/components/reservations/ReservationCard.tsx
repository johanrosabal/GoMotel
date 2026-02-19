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

const statusColorStyles: Record<Reservation['status'], string> = {
  Confirmed: 'border-blue-500',
  'Checked-in': 'border-green-500',
  Cancelled: 'border-red-500',
  'No-show': 'border-yellow-500',
  Completed: 'border-gray-400',
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
    'Checked-in': 'Checked-in',
    Cancelled: 'Cancelada',
    'No-show': 'No-show',
    Completed: 'Completada',
}

export default function ReservationCard({ reservation, isOverdue = false }: { reservation: Reservation; isOverdue?: boolean }) {
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
