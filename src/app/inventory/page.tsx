import InventoryTable from '@/components/inventory/InventoryTable';
import { getServices } from '@/lib/actions/service.actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AddService from '@/components/inventory/AddService';
import { Package } from 'lucide-react';

export default async function InventoryPage() {
  const initialServices = await getServices();

  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-8 w-8 text-primary" />
            Control de Inventario
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Monitoreo en tiempo real de existencias, precios de costo y alertas de stock bajo.
          </p>
        </div>
        <AddService allServices={initialServices} />
      </div>

      <Card>
        <CardHeader>
            <div>
                <CardTitle>Listado de Existencias</CardTitle>
                <CardDescription>
                  Consulte el estado actual de sus activos y productos para la venta.
                </CardDescription>
            </div>
        </CardHeader>
        <CardContent>
            <InventoryTable initialServices={initialServices} />
        </CardContent>
      </Card>
    </div>
  );
}
