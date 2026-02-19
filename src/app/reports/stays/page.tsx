import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import StaysReportPage from '@/components/reports/stays/StaysReportPage';

export default function StaysReportRootPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Registro de Estancias
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Consulte el historial completo de todas las estancias activas y pasadas en el motel.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Historial de Movimientos</CardTitle>
          <CardDescription>
            Listado de todas las estancias registradas en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StaysReportPage />
        </CardContent>
      </Card>
    </div>
  );
}
