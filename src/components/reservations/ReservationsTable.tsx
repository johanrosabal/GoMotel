'use client';

import { useTransition, useState, useMemo } from 'react';
import type { Reservation, ReservationStatus } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MoreHorizontal, LogIn, XCircle, User, BedDouble, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { checkInFromReservation, cancelReservation } from '@/lib/actions/reservation.actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

const statusStyles: Record<Reservation['status'], string> = {
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

function ActionsMenu({ reservation }: { reservation: Reservation }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

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
        });
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button aria-haspopup="true" size="icon" variant="ghost" disabled={isPending}>
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Toggle menu</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {reservation.status === 'Confirmed' && (
                    <DropdownMenuItem onClick={handleCheckIn} disabled={isPending}>
                        <LogIn className="mr-2 h-4 w-4" />
                        <span>Hacer Check-in</span>
                    </DropdownMenuItem>
                )}
                 {reservation.status === 'Confirmed' && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                <XCircle className="mr-2 h-4 w-4" />
                                <span>Cancelar Reservación</span>
                            </DropdownMenuItem>
                        </AlertDialogTrigger>
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
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default function ReservationsTable({ reservations }: { reservations: Reservation[] }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');

    const filteredReservations = useMemo(() => {
        return reservations.filter(res => {
            const searchContent = `${res.guestName} ${res.roomNumber}`.toLowerCase();
            const searchMatch = searchContent.includes(searchTerm.toLowerCase());
            const statusMatch = statusFilter === 'all' || res.status === statusFilter;
            return searchMatch && statusMatch;
        });
    }, [reservations, searchTerm, statusFilter]);

    if (reservations.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                No se encontraron reservaciones.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
                <Input
                    placeholder="Buscar por huésped o habitación..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                />
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los Estados</SelectItem>
                        <SelectItem value="Confirmed">Confirmada</SelectItem>
                        <SelectItem value="Checked-in">Checked-in</SelectItem>
                        <SelectItem value="Cancelled">Cancelada</SelectItem>
                        <SelectItem value="No-show">No-show</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {filteredReservations.length === 0 ? (
                 <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                    No se encontraron reservaciones con los filtros actuales.
                </div>
            ) : (
                <>
                    {/* Mobile View */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:hidden">
                        {filteredReservations.map(res => (
                            <Card key={res.id}>
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
                                        <ActionsMenu reservation={res} />
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
                                    <div className="flex justify-end pt-2">
                                        <Badge variant="outline" className={cn('font-semibold', statusStyles[res.status])}>
                                            {statusMap[res.status]}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
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
                                    <TableHead>Estado</TableHead>
                                    <TableHead><span className="sr-only">Acciones</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredReservations.map(res => (
                                    <TableRow key={res.id}>
                                        <TableCell className="font-medium">{res.guestName}</TableCell>
                                        <TableCell>
                                            <div>N° {res.roomNumber}</div>
                                            <div className="text-xs text-muted-foreground">{res.roomType}</div>
                                        </TableCell>
                                        <TableCell>{format(res.checkInDate.toDate(), 'PPpp', { locale: es })}</TableCell>
                                        <TableCell>{format(res.checkOutDate.toDate(), 'PPpp', { locale: es })}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn('font-semibold', statusStyles[res.status])}>
                                                {statusMap[res.status]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <ActionsMenu reservation={res} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </>
            )}
        </div>
    );
}
