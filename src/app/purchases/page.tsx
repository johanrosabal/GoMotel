import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart } from 'lucide-react';
import PurchasesClientPage from '@/components/purchases/PurchasesClientPage';

export default function PurchasesRootPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingCart className="h-8 w-8" />
          Historial de Compras
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Consulte y registre facturas de compra de sus proveedores para mantener el inventario actualizado.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Registro de Compras</CardTitle>
          <CardDescription>
            Listado de todas las facturas de compra registradas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PurchasesClientPage />
        </CardContent>
      </Card>
    </div>
  );
}
