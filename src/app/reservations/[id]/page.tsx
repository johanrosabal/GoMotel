import PublicReservationPage from '@/components/reservations/PublicReservationPage';
import { notFound } from 'next/navigation';

export default async function PublicReservationRootPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    if (!id) {
        notFound();
    }

    return (
        <PublicReservationPage reservationId={id} />
    );
}
