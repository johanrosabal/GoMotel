import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import ReportsClientPage from '@/components/reports/ReportsClientPage';

export default function ReportsRootPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" />
          Reportes y Estadísticas
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Análisis detallado de ingresos, ocupación y rendimiento operativo del motel.
        </p>
      </div>
      <ReportsClientPage />
    </div>
  );
}
