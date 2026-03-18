import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookCopy, ShoppingCart } from 'lucide-react';
import CatalogClientPage from '@/components/catalog/CatalogClientPage';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function CatalogRootPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookCopy className="h-8 w-8" />
            Catálogo de Productos
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Administre las categorías, subcategorías y productos (servicios) que se ofrecen.
          </p>
        </div>
        <Button asChild variant="outline" className="shadow-sm">
          <Link href="/purchases">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Registrar Compras
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Catálogo</CardTitle>
          <CardDescription>
            Seleccione una categoría para ver sus subcategorías, y luego una subcategoría para ver y administrar sus productos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CatalogClientPage />
        </CardContent>
      </Card>
    </div>
  );
}
