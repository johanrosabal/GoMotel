'use client';
import type { Reservation } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import ReservationActionsMenu from './ReservationActionsMenu';
import { useMemo } from 'react';
import { CheckCircle, AlertCircle, XCircle, Ban, BedDouble, UserX } from 'lucide-react';

type ProcessedReservation = Reservation & { isOverdue: boolean };

const statusConfig: Record<Reservation['status'], { icon: React.ElementType, color: string, badge: string }> = {
    Confirmed: { icon: CheckCircle, color: 'text-blue-500', badge: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50' },
    'Checked-in': { icon: BedDouble, color: 'text-green-500', badge: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50' },
    Cancelled: { icon: XCircle, color: 'text-red-500', badge: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50' },
    'No-show': { icon: UserX, color: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/50'},
    Completed: { icon: Ban, color: 'text-gray-500', badge: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800/50' },
};

const statusMap: Record<Reservation['status'], string> = {
    Confirmed: 'Confirmada',
    'Checked-in': 'Checked-in',
    Cancelled: 'Cancelada',
    'No-show': 'No-show',
    Completed: 'Completada',
};

export default function ReservationsTimeline({ reservations }: { reservations: ProcessedReservation[] }) {

    const reservationsByDay = useMemo(() => {
        return reservations.reduce<Record<string, ProcessedReservation[]>>((acc, res) => {
            const day = format(res.checkInDate.toDate(), 'yyyy-MM-dd');
            if (!acc[day]) {
                acc[day] = [];
            }
            acc[day].push(res);
            return acc;
        }, {});
    }, [reservations]);
    
    const sortedDays = useMemo(() => Object.keys(reservationsByDay).sort(), [reservationsByDay]);

    if (reservations.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                No se encontraron reservaciones con los filtros actuales.
            </div>
        );
    }
    
    return (
        <div className="relative pl-6">
            {/* The vertical timeline bar */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border -translate-x-1/2"></div>
            
            <div className="space-y-12">
                {sortedDays.map(day => (
                    <div key={day} className="relative">
                        <div className="absolute -left-6 top-1.5 -translate-x-1/2 w-4 h-4 rounded-full bg-primary ring-4 ring-background"></div>
                        <h2 className="font-bold text-lg capitalize -ml-1 mb-6">
                            {format(new Date(day), "eeee, dd 'de' MMMM", { locale: es })}
                        </h2>
                        
                        <div className="space-y-8">
                            {reservationsByDay[day].map(res => {
                                const { icon: Icon, color, badge: badgeColor } = statusConfig[res.status];
                                const finalIcon = res.isOverdue ? AlertCircle : Icon;
                                const finalColor = res.isOverdue ? 'text-destructive' : color;
                                const finalBadgeColor = res.isOverdue ? 'bg-destructive/10 text-destructive border-destructive/20' : badgeColor;

                                return (
                                    <div key={res.id} className="flex items-start gap-4 relative">
                                        <div className={cn("absolute -left-6 top-[5px] -translate-x-1/2 h-3 w-3 rounded-full ring-4 ring-background", res.isOverdue ? 'bg-destructive' : 'bg-muted-foreground' )}></div>
                                        <div className="w-20 text-right shrink-0">
                                            <p className="font-bold text-sm">{format(res.checkInDate.toDate(), 'p', { locale: es })}</p>
                                        </div>
                                        <div className="flex-1 border rounded-lg p-4 bg-card shadow-sm">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-semibold">{res.guestName}</p>
                                                    <p className="text-sm text-muted-foreground">Habitación {res.roomNumber} ({res.roomType})</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className={cn('font-semibold', finalBadgeColor)}>
                                                        {res.isOverdue ? 'Vencida' : statusMap[res.status]}
                                                    </Badge>
                                                    <ReservationActionsMenu reservation={res} />
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-2">
                                                Check-out: {format(res.checkOutDate.toDate(), "p", { locale: es })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
