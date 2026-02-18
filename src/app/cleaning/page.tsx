import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import CleaningQueuePage from '@/components/cleaning/CleaningQueuePage';

export default function CleaningRootPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-8 w-8" />
          Cola de Trabajo de Limpieza
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Administre y actualice el estado de las habitaciones que están pendientes de limpieza.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Habitaciones por Limpiar</CardTitle>
          <CardDescription>
            Listado de todas las habitaciones que actualmente tienen el estado "Limpieza".
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CleaningQueuePage />
        </CardContent>
      </Card>
    </div>
  );
}
