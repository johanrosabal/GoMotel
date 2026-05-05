import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Reservation } from '@/types';
import PublicReservationPage from '@/components/reservations/PublicReservationPage';
import { notFound } from 'next/navigation';

async function getReservation(id: string): Promise<Reservation | null> {
    try {
        const reservationDoc = await getDoc(doc(db, 'reservations', id));
        if (reservationDoc.exists()) {
            return { id: reservationDoc.id, ...reservationDoc.data() } as Reservation;
        }
        return null;
    } catch (error) {
        console.error("Error fetching reservation:", error);
        return null;
    }
}

// Helper to serialize reservation data before passing to client component
function serializeReservation(reservation: Reservation) {
    return {
        ...reservation,
        checkInDate: reservation.checkInDate.toDate().toISOString(),
        checkOutDate: reservation.checkOutDate.toDate().toISOString(),
        createdAt: reservation.createdAt.toDate().toISOString(),
    };
}

export default async function PublicReservationRootPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    if (!id) {
        notFound();
    }
    
    const reservation = await getReservation(id);

    if (!reservation) {
        notFound();
    }
    
    const serializedReservation = serializeReservation(reservation);

    return (
        <PublicReservationPage reservationData={serializedReservation} />
    );
}
