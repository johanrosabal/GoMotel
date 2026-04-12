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
  Confirmed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Checked-in': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  'No-show': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Completed: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const statusMap: Record<Reservation['status'], string> = {
    Confirmed: 'Confirmada',
    'Checked-in': 'Checked-in',
    Cancelled: 'Cancelada',
    'No-show': 'No se presentó',
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
                            <Card key={res.id} className={cn(
                                "bg-white/5 backdrop-blur-xl border-white/10 rounded-[2.5rem] overflow-hidden transition-all",
                                res.isOverdue && 'border-rose-500 shadow-lg shadow-rose-500/20 shadow-[0_0_15px_rgba(251,113,133,0.3)]'
                            )}>
                                <CardHeader className="pb-4 pt-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <CardTitle className="flex items-center gap-2 text-white font-black uppercase italic tracking-tighter text-lg">
                                                <User className="w-5 h-5 text-primary" />
                                                {res.guestName}
                                            </CardTitle>
                                            <CardDescription className="flex items-center gap-2 pl-1 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">
                                                <BedDouble className="w-4 h-4" />
                                                Habitación {res.roomNumber} ({res.roomType})
                                            </CardDescription>
                                        </div>
                                        <ReservationActionsMenu reservation={res} className="bg-white/5 border border-white/10 rounded-xl" />
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4 text-xs pb-8">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-4 rounded-2xl bg-black/20 p-4 border border-white/5">
                                            <CalendarClock className="w-5 h-5 text-slate-500" />
                                            <div>
                                                <p className="font-black uppercase tracking-widest text-[9px] text-slate-500 mb-1">Check-in</p>
                                                <p className="font-bold text-white uppercase">{format(res.checkInDate.toDate(), "dd MMM, h:mm a", { locale: es })}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 rounded-2xl bg-black/20 p-4 border border-white/5">
                                            <CalendarClock className="w-5 h-5 text-slate-500" />
                                            <div>
                                                <p className="font-black uppercase tracking-widest text-[9px] text-slate-500 mb-1">Check-out</p>
                                                <p className="font-bold text-white uppercase">{format(res.checkOutDate.toDate(), "dd MMM, h:mm a", { locale: es })}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                        <div className="flex items-center gap-3">
                                            <Clock className="w-4 h-4 text-primary" />
                                            <TimeRemaining checkOutDate={res.checkOutDate.toDate()} status={res.status} className="text-[10px] font-black uppercase tracking-widest text-primary" />
                                        </div>
                                        <Badge variant="outline" className={cn('font-black text-[9px] uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border shadow-lg', statusStyles[res.status])}>
                                            {statusMap[res.status]}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>

                {/* Desktop View */}
                <div className="hidden md:block rounded-[2rem] border border-white/10 overflow-hidden bg-white/5 backdrop-blur-xl">
                    <Table>
                        <TableHeader className="bg-white/5">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 h-16 pl-8">Huésped</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 h-16">Habitación</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 h-16">Check-in</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 h-16">Check-out</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 h-16">Tiempo</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 h-16">Estado</TableHead>
                                <TableHead className="h-16 pr-8"><span className="sr-only">Acciones</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reservations.map(res => {
                                return (
                                <TableRow key={res.id} className={cn(
                                    "border-white/5 transition-colors group hover:bg-white/5",
                                    res.isOverdue && "bg-rose-500/5 border-l-[6px] border-l-rose-500"
                                )}>
                                    <TableCell className="font-black text-white uppercase italic tracking-tight text-sm pl-8">
                                        {res.guestName}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-black text-white text-[11px] uppercase">N° {res.roomNumber}</div>
                                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest italic">{res.roomType}</div>
                                    </TableCell>
                                    <TableCell className="text-[11px] font-bold text-slate-300 uppercase">
                                        {format(res.checkInDate.toDate(), "dd MMM, h:mm a", { locale: es })}
                                    </TableCell>
                                    <TableCell className="text-[11px] font-bold text-slate-300 uppercase">
                                        {format(res.checkOutDate.toDate(), "dd MMM, h:mm a", { locale: es })}
                                    </TableCell>
                                    <TableCell>
                                        <TimeRemaining checkOutDate={res.checkOutDate.toDate()} status={res.status} className="text-[10px] font-black uppercase tracking-widest text-primary" />
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn('font-black text-[9px] uppercase tracking-[0.2em] px-4 py-1 rounded-full border shadow-lg', statusStyles[res.status])}>
                                            {statusMap[res.status]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <ReservationActionsMenu reservation={res} className="bg-white/5 border border-white/10 rounded-xl" />
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
