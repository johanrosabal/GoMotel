import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt } from 'lucide-react';
import InvoicesClientPage from '@/components/billing/invoices/InvoicesClientPage';

export default function InvoicesRootPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Receipt className="h-8 w-8" />
          Gestión de Facturas
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Consulte el historial de todas las facturas generadas en el sistema.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Historial de Facturación</CardTitle>
          <CardDescription>
            Listado de todas las facturas pagadas y pendientes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvoicesClientPage />
        </CardContent>
      </Card>
    </div>
  );
}

    