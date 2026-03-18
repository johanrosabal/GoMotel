import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookCopy, Package, ShoppingCart } from 'lucide-react';
import PurchasesClientPage from '@/components/purchases/PurchasesClientPage';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function PurchasesRootPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-8 w-8" />
            Historial de Compras
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Consulte y registre facturas de compra de sus proveedores para mantener el inventario actualizado.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button asChild variant="outline" className="shadow-sm" id="page-button-1">
            <Link href="/inventory" id="page-link-inventario">
              <Package className="mr-2 h-4 w-4" />
              Inventario
            </Link>
          </Button>
          <Button asChild variant="outline" className="shadow-sm" id="page-button-2">
            <Link href="/catalog" id="page-link-cat-logo-de-productos">
              <BookCopy className="mr-2 h-4 w-4" />
              Catálogo de Productos
            </Link>
          </Button>
        </div>
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
