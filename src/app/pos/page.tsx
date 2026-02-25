
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingBasket } from 'lucide-react';
import PosClientPage from '@/components/pos/PosClientPage';

export default function PosRootPage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingBasket className="h-8 w-8 text-primary" />
          Punto de Venta (POS)
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Realice ventas directas de productos y servicios sin necesidad de vincular una habitación.
        </p>
      </div>
      <PosClientPage />
    </div>
  );
}
