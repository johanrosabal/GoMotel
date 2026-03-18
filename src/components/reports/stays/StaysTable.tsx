'use client';

import type { Stay } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';

export default function StaysTable({ stays }: { stays: Stay[] }) {
    if (stays.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                No se encontraron estancias con los filtros actuales.
            </div>
        );
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Huésped</TableHead>
                        <TableHead>Habitación</TableHead>
                        <TableHead>Check-in</TableHead>
                        <TableHead>Check-out</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead><span className="sr-only">Acciones</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {stays.map(stay => (
                        <TableRow key={stay.id}>
                            <TableCell className="font-medium">{stay.guestName}</TableCell>
                            <TableCell>{stay.roomNumber}</TableCell>
                            <TableCell>{format(stay.checkIn.toDate(), "dd MMM, h:mm a", { locale: es })}</TableCell>
                            <TableCell>
                                {stay.checkOut ? format(stay.checkOut.toDate(), "dd MMM, h:mm a", { locale: es }) : '-'}
                            </TableCell>
                            <TableCell>{stay.isPaid ? formatCurrency(stay.total) : '-'}</TableCell>
                            <TableCell>
                                {stay.checkOut ? (
                                    <Badge variant="outline">Completada</Badge>
                                ) : (
                                    <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50">Activa</Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                <Button asChild variant="ghost" size="icon" id="staystable-button-1">
                                    <Link href={`/rooms/${stay.roomId}`} id="staystable-link-1">
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
