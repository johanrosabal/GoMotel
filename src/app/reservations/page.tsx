import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarPlus } from 'lucide-react';

export default function ReservationsPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarPlus className="h-8 w-8" />
            Crear Reservaciones
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Aquí podrá crear y gestionar las futuras reservaciones de su motel.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Próximamente</CardTitle>
          <CardDescription>
            La funcionalidad completa para crear y gestionar reservaciones estará disponible aquí.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <h3 className="text-lg font-medium text-muted-foreground">Módulo en Construcción</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Estamos trabajando para traerle una gestión de reservaciones de primera clase.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
