'use client';

import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy as fbOrderBy } from "firebase/firestore";
import type { Reservation, ReservationStatus } from "@/types";
import { Skeleton } from "../ui/skeleton";
import ReservationsTable from "./ReservationsTable";
import { Button } from "../ui/button";
import { PlusCircle, UserPlus, List, LayoutGrid } from "lucide-react";
import CreateReservationDialog from "./CreateReservationDialog";
import AddClientDialog from "../clients/AddClientDialog";
import { useState, useMemo } from "react";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import ReservationsGrid from "./ReservationsGrid";

export default function ReservationsClientPage() {
    const { firestore } = useFirebase();
    const [view, setView] = useState<'list' | 'grid'>('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');


    const reservationsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, "reservations"), fbOrderBy("checkInDate", "desc"));
    }, [firestore]);

    const { data: reservations, isLoading } = useCollection<Reservation>(reservationsQuery);

    const filteredReservations = useMemo(() => {
        if (!reservations) return [];
        return reservations.filter(res => {
            const searchContent = `${res.guestName} ${res.roomNumber}`.toLowerCase();
            const searchMatch = searchContent.includes(searchTerm.toLowerCase());
            const statusMatch = statusFilter === 'all' || res.status === statusFilter;
            return searchMatch && statusMatch;
        });
    }, [reservations, searchTerm, statusFilter]);

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
                <ReservationsTable reservations={filteredReservations} />
            ) : (
                <ReservationsGrid reservations={filteredReservations} />
            )}
        </div>
    );
}
