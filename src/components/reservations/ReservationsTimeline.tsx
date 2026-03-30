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
    Confirmed: { icon: CheckCircle, color: 'text-blue-400', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    'Checked-in': { icon: BedDouble, color: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    Cancelled: { icon: XCircle, color: 'text-rose-400', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    'No-show': { icon: UserX, color: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20'},
    Completed: { icon: Ban, color: 'text-slate-400', badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
};

const statusMap: Record<Reservation['status'], string> = {
    Confirmed: 'Confirmada',
    'Checked-in': 'Checked-in',
    Cancelled: 'Cancelada',
    'No-show': 'No se presentó',
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
        <div className="relative pl-12 pt-8 pb-12">
            {/* The vertical timeline bar */}
            <div className="absolute left-6 top-10 bottom-10 w-px bg-white/10 -translate-x-1/2 shadow-[0_0_10px_rgba(255,255,255,0.05)]"></div>
            
            <div className="space-y-16">
                {sortedDays.map(day => (
                    <div key={day} className="relative">
                        <div className="absolute -left-12 top-2 -translate-x-1/2 w-5 h-5 rounded-full bg-primary ring-8 ring-white/5 border-4 border-black shadow-[0_0_15px_rgba(var(--primary),0.3)]"></div>
                        <h2 className="font-black text-2xl uppercase italic tracking-tighter text-white -ml-4 mb-8 flex items-center gap-4">
                            {format(new Date(day), "eeee, dd 'de' MMMM", { locale: es })}
                            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                        </h2>
                        
                        <div className="space-y-10 pl-4">
                            {reservationsByDay[day].map(res => {
                                const { icon: Icon, color, badge: badgeColor } = statusConfig[res.status];
                                const finalColor = res.isOverdue ? 'text-rose-500' : color;
                                const finalBadgeColor = res.isOverdue ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-rose-500/10' : badgeColor;

                                return (
                                    <div key={res.id} className="flex items-start gap-8 relative group">
                                        <div className={cn(
                                            "absolute -left-10 top-2.5 -translate-x-1/2 h-3.5 w-3.5 rounded-full ring-4 ring-black border-2 border-white/20 transition-all group-hover:scale-125", 
                                            res.isOverdue ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'bg-slate-600' 
                                        )}></div>
                                        <div className="w-24 text-right shrink-0 pt-1">
                                            <p className="font-black text-sm text-white uppercase italic tracking-tighter group-hover:text-primary transition-colors">
                                                {format(res.checkInDate.toDate(), 'h:mm a', { locale: es })}
                                            </p>
                                        </div>
                                        <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden transition-all group-hover:bg-white/[0.08] group-hover:border-white/20">
                                            <div className="absolute top-0 left-0 w-1 h-full opacity-50 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
                                            
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="space-y-2">
                                                    <p className="font-black text-lg text-white uppercase italic tracking-tighter leading-none">{res.guestName}</p>
                                                    <div className="flex items-center gap-3">
                                                       <Badge variant="outline" className="font-black text-[9px] uppercase tracking-widest bg-white/5 border-white/10 text-slate-400 rounded-lg h-5 px-2">
                                                           Hab. {res.roomNumber}
                                                       </Badge>
                                                       <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest italic">{res.roomType}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Badge variant="outline" className={cn('font-black text-[9px] uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border shadow-lg transition-all', finalBadgeColor)}>
                                                        {res.isOverdue ? 'Vencida' : statusMap[res.status]}
                                                    </Badge>
                                                    <ReservationActionsMenu reservation={res} className="bg-white/5 border border-white/10 rounded-xl" />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
                                                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                                Check-out Estimado: <span className="text-slate-300 ml-1">{format(res.checkOutDate.toDate(), "h:mm a", { locale: es })}</span>
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
