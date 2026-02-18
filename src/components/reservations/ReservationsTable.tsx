'use client';

import type { Reservation } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { User, BedDouble, CalendarClock, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import ReservationActionsMenu from './ReservationActionsMenu';
import TimeRemaining from './TimeRemaining';

const statusStyles: Record<Reservation['status'], string> = {
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
    Completed: 'Completada'
}

type ProcessedReservation = Reservation & { isOverdue: boolean };

export default function ReservationsTable({ reservations }: { reservations: ProcessedReservation[] }) {
    if (reservations.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                No se encontraron reservaciones con los filtros actuales.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <>
                {/* Mobile View */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:hidden">
                    {reservations.map(res => {
                        return (
                            <Card key={res.id} className={cn(res.isOverdue && 'animate-pulse-border border-destructive')}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <CardTitle className="flex items-center gap-2">
                                                <User className="w-5 h-5 text-muted-foreground" />
                                                {res.guestName}
                                            </CardTitle>
                                            <CardDescription className="flex items-center gap-2 pl-1">
                                                <BedDouble className="w-4 h-4 text-muted-foreground" />
                                                Habitación {res.roomNumber} ({res.roomType})
                                            </CardDescription>
                                        </div>
                                        <ReservationActionsMenu reservation={res} />
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <div className="flex items-center gap-3 rounded-md bg-muted/50 p-3">
                                        <CalendarClock className="w-5 h-5 text-muted-foreground" />
                                        <div>
                                            <p className="font-semibold">Check-in:</p>
                                            <p>{format(res.checkInDate.toDate(), 'PP p', { locale: es })}</p>
                                        </div>
                                    </div>
                                     <div className="flex items-center gap-3 rounded-md bg-muted/50 p-3">
                                        <CalendarClock className="w-5 h-5 text-muted-foreground" />
                                        <div>
                                            <p className="font-semibold">Check-out:</p>
                                            <p>{format(res.checkOutDate.toDate(), 'PP p', { locale: es })}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 rounded-md bg-muted/50 p-3">
                                        <Clock className="w-5 h-5 text-muted-foreground" />
                                        <div>
                                            <p className="font-semibold">Tiempo Restante:</p>
                                            <TimeRemaining checkOutDate={res.checkOutDate.toDate()} status={res.status} />
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-2">
                                        <Badge variant="outline" className={cn('font-semibold', statusStyles[res.status])}>
                                            {statusMap[res.status]}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>

                {/* Desktop View */}
                <div className="hidden md:block rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Huésped</TableHead>
                                <TableHead>Habitación</TableHead>
                                <TableHead>Check-in</TableHead>
                                <TableHead>Check-out</TableHead>
                                <TableHead>Tiempo Restante</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead><span className="sr-only">Acciones</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reservations.map(res => {
                                return (
                                <TableRow key={res.id} className={cn(res.isOverdue && "animate-pulse-border border-l-4 border-destructive")}>
                                    <TableCell className="font-medium">{res.guestName}</TableCell>
                                    <TableCell>
                                        <div>N° {res.roomNumber}</div>
                                        <div className="text-xs text-muted-foreground">{res.roomType}</div>
                                    </TableCell>
                                    <TableCell>{format(res.checkInDate.toDate(), 'PPpp', { locale: es })}</TableCell>
                                    <TableCell>{format(res.checkOutDate.toDate(), 'PPpp', { locale: es })}</TableCell>
                                    <TableCell>
                                        <TimeRemaining checkOutDate={res.checkOutDate.toDate()} status={res.status} />
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn('font-semibold', statusStyles[res.status])}>
                                            {statusMap[res.status]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <ReservationActionsMenu reservation={res} />
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                </div>
            </>
        </div>
    );
}
