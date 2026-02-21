import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart } from 'lucide-react';
import PurchasesClientPage from '@/components/purchases/PurchasesClientPage';

export default function PurchasesRootPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingCart className="h-8 w-8" />
          Gestión de Compras
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Registre la entrada de nuevos productos para actualizar el inventario.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Registrar Compra</CardTitle>
          <CardDescription>
            Seleccione los productos y las cantidades compradas para añadirlas al stock.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PurchasesClientPage />
        </CardContent>
      </Card>
    </div>
  );
}
