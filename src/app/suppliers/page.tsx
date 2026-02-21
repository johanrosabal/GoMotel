import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck } from 'lucide-react';
import SuppliersClientPage from '@/components/suppliers/SuppliersClientPage';

export default function SuppliersRootPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Truck className="h-8 w-8" />
          Gestión de Proveedores
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Administre la información de contacto y los detalles de sus proveedores.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Proveedores</CardTitle>
          <CardDescription>
            Listado de todos los proveedores registrados en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SuppliersClientPage />
        </CardContent>
      </Card>
    </div>
  );
}
