import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Percent } from 'lucide-react';
import TaxesClientPage from '@/components/settings/taxes/TaxesClientPage';

export default function TaxesRootPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Percent className="h-8 w-8" />
          Gestión de Impuestos
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Administre los impuestos aplicables a los productos y servicios de su motel.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Impuestos</CardTitle>
          <CardDescription>
            Listado de todos los impuestos configurados en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaxesClientPage />
        </CardContent>
      </Card>
    </div>
  );
}
