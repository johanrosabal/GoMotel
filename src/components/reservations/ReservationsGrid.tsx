'use client';
import type { Reservation } from '@/types';
import ReservationCard from './ReservationCard';

export default function ReservationsGrid({ reservations }: { reservations: Reservation[] }) {
    if (reservations.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                No se encontraron reservaciones con los filtros actuales.
            </div>
        );
    }
    
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {reservations.map(res => (
                <ReservationCard key={res.id} reservation={res} />
            ))}
        </div>
    );
}
