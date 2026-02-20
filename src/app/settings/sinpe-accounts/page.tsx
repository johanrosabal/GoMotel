import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone } from 'lucide-react';
import SinpeAccountsClientPage from '@/components/settings/sinpe-accounts/SinpeAccountsClientPage';

export default function SinpeAccountsPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="flex justify-between items-start">
        <div className="space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Smartphone className="h-8 w-8" />
            Gestión de Cuentas SINPE Móvil
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Administre las cuentas SINPE Móvil utilizadas para recibir pagos en su motel.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Cuentas SINPE</CardTitle>
          <CardDescription>
            Listado de todas las cuentas SINPE configuradas en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SinpeAccountsClientPage />
        </CardContent>
      </Card>
    </div>
  );
}