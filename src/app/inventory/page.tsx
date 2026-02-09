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
                    <CardTitle>Services & Inventory</CardTitle>
                    <CardDescription>
                    Manage your motel's services and track stock levels.
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
