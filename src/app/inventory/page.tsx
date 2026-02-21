import InventoryTable from '@/components/inventory/InventoryTable';
import AddService from '@/components/inventory/AddService';
import { getServices } from '@/lib/actions/service.actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function InventoryPage() {
  const initialServices = await getServices();
  const allServices = await getServices();

  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Gestión de Inventario</CardTitle>
                    <CardDescription>
                    Controle los niveles de stock de sus productos y servicios.
                    </CardDescription>
                </div>
                <AddService allServices={allServices} />
            </div>
        </CardHeader>
        <CardContent>
            <InventoryTable initialServices={initialServices} allServices={allServices} />
        </CardContent>
      </Card>
    </div>
  );
}
