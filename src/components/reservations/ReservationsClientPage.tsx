'use client';

import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy as fbOrderBy } from "firebase/firestore";
import type { Reservation, ReservationStatus } from "@/types";
import { Skeleton } from "../ui/skeleton";
import ReservationsTable from "./ReservationsTable";
import { Button } from "../ui/button";
import { PlusCircle, UserPlus, List, LayoutGrid, CalendarDays } from "lucide-react";
import CreateReservationDialog from "./CreateReservationDialog";
import AddClientDialog from "../clients/AddClientDialog";
import { useState, useMemo, useEffect, useRef } from "react";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import ReservationsGrid from "./ReservationsGrid";
import ReservationsTimeline from "./ReservationsTimeline";
import { playNotificationSound } from "@/lib/sound";
import { useToast } from "@/hooks/use-toast";

export default function ReservationsClientPage() {
    const { firestore } = useFirebase();
    const [view, setView] = useState<'list' | 'grid' | 'timeline'>('list');
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
        const timer = setInterval(() => setNow(new Date()), 30000); // Rerender every 30s
        return () => clearInterval(timer);
    }, []);

    const processedReservations = useMemo(() => {
        if (!reservations) return [];
        return reservations
            .filter(res => {
                const searchContent = `${res.guestName} ${res.roomNumber}`.toLowerCase();
                const searchMatch = searchContent.includes(searchTerm.toLowerCase());
                const statusMatch = statusFilter === 'all' || res.status === statusFilter;
                return searchMatch && statusMatch;
            })
            .map(res => ({
                ...res,
                isOverdue: res.status === 'Checked-in' && now > res.checkOutDate.toDate(),
            }));
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
                toast({
                    variant: 'destructive',
                    title: `Reservación Vencida: Hab. ${reservation.roomNumber}`,
                    description: `La estancia de ${reservation.guestName} ha terminado.`,
                    duration: 15000,
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
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="flex items-center gap-2">
                    <Input
                        placeholder="Buscar por huésped o habitación..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-xs"
                    />
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Filtrar por estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los Estados</SelectItem>
                            <SelectItem value="Confirmed">Confirmada</SelectItem>
                            <SelectItem value="Checked-in">Checked-in</SelectItem>
                            <SelectItem value="Completed">Completada</SelectItem>
                            <SelectItem value="Cancelled">Cancelada</SelectItem>
                            <SelectItem value="No-show">No-show</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="flex items-center gap-2 self-end sm:self-center">
                    <div className="flex items-center gap-1 rounded-md bg-muted p-1">
                        <Button
                            variant={view === 'list' ? 'secondary' : 'ghost'}
                            size="icon"
                            onClick={() => setView('list')}
                            className="h-8 w-8"
                            aria-label="Vista de lista"
                        >
                            <List className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={view === 'grid' ? 'secondary' : 'ghost'}
                            size="icon"
                            onClick={() => setView('grid')}
                            className="h-8 w-8"
                             aria-label="Vista de cuadrícula"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                         <Button
                            variant={view === 'timeline' ? 'secondary' : 'ghost'}
                            size="icon"
                            onClick={() => setView('timeline')}
                            className="h-8 w-8"
                            aria-label="Vista de línea de tiempo"
                        >
                            <CalendarDays className="h-4 w-4" />
                        </Button>
                    </div>
                     <AddClientDialog>
                        <Button variant="outline">
                            <UserPlus className="mr-2 h-4 w-4" />
                            Añadir Cliente
                        </Button>
                    </AddClientDialog>
                    <CreateReservationDialog>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Crear Reservación
                        </Button>
                    </CreateReservationDialog>
                </div>
            </div>
            {isLoading ? (
                <div className="space-y-2 rounded-md border p-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : view === 'list' ? (
                <ReservationsTable reservations={processedReservations} />
            ) : view === 'grid' ? (
                <ReservationsGrid reservations={processedReservations} />
            ) : (
                <ReservationsTimeline reservations={sortedForTimeline} />
            )}
        </div>
    );
}
