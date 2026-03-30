'use client';

import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy as fbOrderBy } from "firebase/firestore";
import type { Reservation, ReservationStatus } from "@/types";
import { Skeleton } from "../ui/skeleton";
import ReservationsTable from "./ReservationsTable";
import { Button } from "../ui/button";
import { PlusCircle, UserPlus, List, LayoutGrid, CalendarDays, Search } from "lucide-react";
import CreateReservationDialog from "./CreateReservationDialog";
import AddClientDialog from "../clients/AddClientDialog";
import { useState, useMemo, useEffect, useRef } from "react";
import { Input } from "../ui/input";
import ReservationsGrid from "./ReservationsGrid";
import ReservationsTimeline from "./ReservationsTimeline";
import { playNotificationSound } from "@/lib/sound";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const STATUS_FILTERS: { label: string; value: ReservationStatus | 'all'; color: string }[] = [
    { label: 'Todas', value: 'all', color: 'bg-muted' },
    { label: 'Por Ingresar', value: 'Confirmed', color: 'bg-blue-500' },
    { label: 'En Habitación', value: 'Checked-in', color: 'bg-green-600' },
    { label: 'Finalizadas', value: 'Completed', color: 'bg-gray-500' },
    { label: 'Canceladas', value: 'Cancelled', color: 'bg-red-500' },
    { label: 'No se presentó', value: 'No-show', color: 'bg-yellow-600' },
];

export default function ReservationsClientPage() {
    const { firestore } = useFirebase();
    const [view, setView] = useState<'list' | 'grid' | 'timeline'>('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');
    const [now, setNow] = useState(new Date());
    const notifiedOverdueReservations = useRef(new Set<string>());
    const { toast } = useToast();

    const reservationsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, "reservations"), fbOrderBy("checkInDate", "desc"));
    }, [firestore]);

    const { data: reservations, isLoading } = useCollection<Reservation>(reservationsQuery);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    const processedReservations = useMemo(() => {
        if (!reservations) return [];
        return reservations
            .filter(res => {
                const searchContent = `${res.guestName} ${res.roomNumber} ${res.roomType}`.toLowerCase();
                const searchMatch = searchContent.includes(searchTerm.toLowerCase());
                const statusMatch = statusFilter === 'all' || res.status === statusFilter;
                return searchMatch && statusMatch;
            })
            .map(res => {
                const isStayOverdue = res.status === 'Checked-in' && now > res.checkOutDate.toDate();
                const isArrivalOverdue = res.status === 'Confirmed' && now > res.checkInDate.toDate();
                return {
                    ...res,
                    isOverdue: isStayOverdue || isArrivalOverdue,
                    isArrivalOverdue,
                };
            });
    }, [reservations, searchTerm, statusFilter, now]);
    
    const sortedForTimeline = useMemo(() => {
        return [...processedReservations].sort((a, b) => a.checkInDate.toDate().getTime() - b.checkInDate.toDate().getTime());
    }, [processedReservations]);


    useEffect(() => {
        const newlyOverdue = processedReservations.filter(r => r.isOverdue && !notifiedOverdueReservations.current.has(r.id));
        
        if (newlyOverdue.length > 0) {
            playNotificationSound();
            newlyOverdue.forEach(reservation => {
                notifiedOverdueReservations.current.add(reservation.id);
                
                const title = reservation.isArrivalOverdue 
                    ? `¡Cliente no llegó!: Hab. ${reservation.roomNumber}`
                    : `¡Check-out vencido!: Hab. ${reservation.roomNumber}`;
                
                const description = reservation.isArrivalOverdue
                    ? `${reservation.guestName} debió ingresar a las ${format(reservation.checkInDate.toDate(), 'h:mm a')}.`
                    : `${reservation.guestName} ya debería haber desocupado la habitación.`;

                toast({
                    variant: 'destructive',
                    title: title,
                    description: description,
                    duration: 10000,
                });
            });
        }
        
        const currentlyOverdueIds = new Set(processedReservations.filter(r => r.isOverdue).map(r => r.id));
        notifiedOverdueReservations.current.forEach(resId => {
            if (!currentlyOverdueIds.has(resId)) {
                notifiedOverdueReservations.current.delete(resId);
            }
        });

    }, [processedReservations, toast]);

    return (
        <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-col gap-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="relative w-full md:max-w-xl group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Buscar por huésped, habitación o tipo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 h-14 bg-white/5 border-white/10 rounded-3xl text-lg text-white font-bold placeholder:text-slate-600 focus:ring-primary/20 focus:border-primary transition-all shadow-2xl" id="reservationsclientpage-input-buscar-por-hu-sped"
                        />
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <AddClientDialog>
                            <Button variant="outline" className="flex-1 md:flex-none h-14 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[10px] px-8 transition-all" id="reservationsclientpage-button-1">
                                <UserPlus className="mr-2 h-4 w-4" />
                                <span className="hidden sm:inline">Nuevo Cliente</span>
                            </Button>
                        </AddClientDialog>
                        <CreateReservationDialog>
                            <Button className="flex-1 md:flex-none h-14 rounded-2xl bg-primary hover:bg-primary/90 text-black font-black uppercase tracking-widest text-[10px] px-8 shadow-xl shadow-primary/20 transition-all active:scale-95" id="reservationsclientpage-button-nueva-reservaci-n">
                                <PlusCircle className="mr-2 h-5 w-5" />
                                Nueva Reservación
                            </Button>
                        </CreateReservationDialog>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-white/5 p-3 rounded-[2rem] border border-white/10 backdrop-blur-md">
                    <div className="flex flex-wrap justify-center gap-2">
                        {STATUS_FILTERS.map((f) => (
                            <button
                                key={f.value}
                                onClick={() => setStatusFilter(f.value)}
                                className={cn(
                                    "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border",
                                    statusFilter === f.value 
                                        ? "bg-primary text-black border-primary shadow-lg shadow-primary/10 scale-105" 
                                        : "bg-white/5 text-slate-400 border-white/5 hover:border-white/20"
                                )} id="reservationsclientpage-button-1-1"
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex items-center gap-1 bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                        <Button
                            variant={view === 'grid' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setView('grid')}
                            className={cn(
                                "h-9 gap-2 font-black uppercase tracking-widest text-[9px] rounded-xl transition-all",
                                view === 'grid' ? "bg-white/10 text-white shadow-xl" : "text-slate-500 hover:text-white"
                            )} id="reservationsclientpage-button-tarjetas"
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            Tarjetas
                        </Button>
                        <Button
                            variant={view === 'timeline' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setView('timeline')}
                            className={cn(
                                "h-9 gap-2 font-black uppercase tracking-widest text-[9px] rounded-xl transition-all",
                                view === 'timeline' ? "bg-white/10 text-white shadow-xl" : "text-slate-500 hover:text-white"
                            )} id="reservationsclientpage-button-agenda"
                        >
                            <CalendarDays className="h-3.5 w-3.5" />
                            Agenda
                        </Button>
                        <Button
                            variant={view === 'list' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setView('list')}
                            className={cn(
                                "h-9 gap-2 font-black uppercase tracking-widest text-[9px] rounded-xl transition-all",
                                view === 'list' ? "bg-white/10 text-white shadow-xl" : "text-slate-500 hover:text-white"
                            )} id="reservationsclientpage-button-lista"
                        >
                            <List className="h-3.5 w-3.5" />
                            Lista
                        </Button>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-48 w-full rounded-xl" />
                    ))}
                </div>
            ) : (
                <div className="pt-2">
                    {view === 'list' ? (
                        <ReservationsTable reservations={processedReservations} />
                    ) : view === 'grid' ? (
                        <ReservationsGrid reservations={processedReservations} />
                    ) : (
                        <ReservationsTimeline reservations={sortedForTimeline} />
                    )}
                </div>
            )}
        </div>
    );
}
