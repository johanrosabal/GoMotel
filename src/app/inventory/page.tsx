import InventoryTable from '@/components/inventory/InventoryTable';
import AddService from '@/components/inventory/AddService';
import { getServices } from '@/lib/actions/service.actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function InventoryPage() {
  const initialServices = await getServices();
  const allServices = await getServices();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Servicios e Inventario</CardTitle>
                    <CardDescription>
                    Administre los servicios de su motel y controle los niveles de stock.
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
