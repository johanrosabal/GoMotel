import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart } from 'lucide-react';
import PurchasesClientPage from '@/components/purchases/PurchasesClientPage';

export default function PurchasesRootPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingCart className="h-8 w-8" />
          Registrar Compra a Proveedor
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Filtre por proveedor para ver sus productos y añada las cantidades compradas para actualizar el inventario.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ingreso de Productos</CardTitle>
          <CardDescription>
            Seleccione un proveedor para registrar un nuevo ingreso de productos al inventario.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PurchasesClientPage />
        </CardContent>
      </Card>
    </div>
  );
}

    