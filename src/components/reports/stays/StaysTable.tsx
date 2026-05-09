'use client';

import type { Stay } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Eye, Clock, CheckCircle2 } from 'lucide-react';

export default function StaysTable({ stays }: { stays: Stay[] }) {
    if (stays.length === 0) {
        return (
            <div className="text-center text-slate-500 font-bold uppercase tracking-wider py-16 bg-black/20 border border-dashed border-white/5 rounded-2xl m-4">
                No se encontraron estancias con los filtros actuales.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader className="bg-black/40">
                    <TableRow className="border-white/5 hover:bg-transparent">
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 py-4">Huésped</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 py-4">Habitación</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 py-4">Check-in</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 py-4">Check-out</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 py-4">Total</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 py-4">Registrado Por</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 py-4">Estado</TableHead>
                        <TableHead className="w-[80px]"><span className="sr-only">Acciones</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {stays.map(stay => (
                        <TableRow key={stay.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                            <TableCell className="font-bold text-white py-4">{stay.guestName}</TableCell>
                            <TableCell className="font-mono text-slate-300">{stay.roomNumber}</TableCell>
                            <TableCell className="text-slate-300 text-sm">
                                {format(stay.checkIn.toDate(), "dd MMM, h:mm a", { locale: es })}
                            </TableCell>
                            <TableCell className="text-slate-300 text-sm">
                                {stay.checkOut ? format(stay.checkOut.toDate(), "dd MMM, h:mm a", { locale: es }) : (
                                    <span className="text-slate-600 font-medium">En curso...</span>
                                )}
                            </TableCell>
                            <TableCell className="font-bold text-white font-mono">
                                {stay.isPaid ? formatCurrency(stay.total) : (
                                    <span className="text-slate-600">-</span>
                                )}
                            </TableCell>
                            <TableCell className="text-slate-300 text-sm">
                                {(stay as any).createdBy || 'N/D'}
                            </TableCell>
                            <TableCell>
                                {stay.checkOut ? (
                                    <div className="flex items-center gap-1.5 text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/20 w-fit">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Completada
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 w-fit">
                                        <Clock className="h-3 w-3 animate-pulse" />
                                        Activa
                                    </div>
                                )}
                            </TableCell>
                            <TableCell className="text-right py-4">
                                <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all" id="staystable-button-1" data-testid="staystable-see-room-button">
                                    <Link href={`/rooms/${stay.roomId}`} id="staystable-link-1" data-testid="staystable-action-link">
                                        <Eye className="h-4 w-4" />
                                        <span className="sr-only">Ver Habitación</span>
                                    </Link>
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
