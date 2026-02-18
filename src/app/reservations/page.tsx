import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarPlus } from 'lucide-react';
import ReservationsClientPage from '@/components/reservations/ReservationsClientPage';

export default function ReservationsPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <CalendarPlus className="h-8 w-8" />
          Gestión de Reservaciones
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Cree, vea y administre las futuras estancias de su motel.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Reservaciones</CardTitle>
          <CardDescription>
            Listado de todas las reservaciones. Use el botón para crear una nueva.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReservationsClientPage />
        </CardContent>
      </Card>
    </div>
  );
}
