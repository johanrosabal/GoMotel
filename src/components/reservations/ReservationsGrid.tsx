'use client';
import type { Reservation } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { User, BedDouble, CalendarClock } from 'lucide-react';
import ReservationActionsMenu from './ReservationActionsMenu';

const statusColorStyles: Record<Reservation['status'], string> = {
  Confirmed: 'border-blue-500',
  'Checked-in': 'border-green-500',
  Cancelled: 'border-red-500',
  'No-show': 'border-yellow-500',
};

const statusBadgeStyles: Record<Reservation['status'], string> = {
  Confirmed: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50',
  'Checked-in': 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50',
  Cancelled: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50',
  'No-show': 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/50',
};

const statusMap: Record<Reservation['status'], string> = {
    Confirmed: 'Confirmada',
    'Checked-in': 'Checked-in',
    Cancelled: 'Cancelada',
    'No-show': 'No-show'
}

export default function ReservationsGrid({ reservations }: { reservations: Reservation[] }) {
    if (reservations.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                No se encontraron reservaciones con los filtros actuales.
            </div>
        );
    }
    
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {reservations.map(res => (
                <Card key={res.id} className={cn("flex flex-col relative border-l-4 hover:shadow-lg transition-shadow duration-200 h-full", statusColorStyles[res.status])}>
                    <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                            <div>
                                <CardTitle className="text-xl font-bold truncate" title={res.guestName}>
                                    {res.guestName}
                                </CardTitle>
                                <CardDescription className="text-xs font-semibold !mt-1">
                                    Hab. {res.roomNumber} ({res.roomType})
                                </CardDescription>
                            </div>
                            <ReservationActionsMenu reservation={res} className="h-7 w-7" />
                        </div>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-3 text-sm mt-4">
                        <div className="flex items-start gap-2">
                            <CalendarClock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-semibold text-muted-foreground text-xs">Check-in</p>
                                <p className="text-xs">{format(res.checkInDate.toDate(), 'PP p', { locale: es })}</p>
                            </div>
                        </div>
                         <div className="flex items-start gap-2">
                            <CalendarClock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-semibold text-muted-foreground text-xs">Check-out</p>
                                <p className="text-xs">{format(res.checkOutDate.toDate(), 'PP p', { locale: es })}</p>
                            </div>
                        </div>
                    </CardContent>
                    <div className="p-6 pt-0 mt-auto flex justify-end">
                         <Badge variant="outline" className={cn('font-semibold', statusBadgeStyles[res.status])}>
                            {statusMap[res.status]}
                        </Badge>
                    </div>
                </Card>
            ))}
        </div>
    );
}
