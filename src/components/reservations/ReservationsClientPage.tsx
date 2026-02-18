'use client';

import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy as fbOrderBy } from "firebase/firestore";
import type { Reservation } from "@/types";
import { Skeleton } from "../ui/skeleton";
import ReservationsTable from "./ReservationsTable";
import { Button } from "../ui/button";
import { PlusCircle } from "lucide-react";
import CreateReservationDialog from "./CreateReservationDialog";

export default function ReservationsClientPage() {
    const { firestore } = useFirebase();

    const reservationsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, "reservations"), fbOrderBy("checkInDate", "desc"));
    }, [firestore]);

    const { data: reservations, isLoading } = useCollection<Reservation>(reservationsQuery);

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <CreateReservationDialog>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Crear Reservación
                    </Button>
                </CreateReservationDialog>
            </div>
            {isLoading ? (
                <div className="space-y-2 rounded-md border p-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : (
                <ReservationsTable reservations={reservations || []} />
            )}
        </div>
    );
}
