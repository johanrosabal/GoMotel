import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import ClientsPage from '@/components/clients/ClientsPage';

export default function ClientsRootPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-8 w-8" />
          Gestión de Clientes
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Administre la base de datos de clientes de su motel para agilizar futuros check-ins y ofrecer un servicio personalizado.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Base de Datos de Clientes</CardTitle>
          <CardDescription>
            Listado de todos los clientes registrados. Use el botón para añadir un nuevo cliente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientsPage />
        </CardContent>
      </Card>
    </div>
  );
}
