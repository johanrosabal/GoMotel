'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { seedDatabase } from '@/lib/actions/seed.actions';
import { Database } from 'lucide-react';

export default function SeedDataButton() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSeed = () => {
    startTransition(async () => {
      const result = await seedDatabase();
      if (result.success) {
        toast({
          title: 'Éxito',
          description: result.success,
        });
      } else if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Button onClick={handleSeed} disabled={isPending}>
      <Database className="mr-2 h-4 w-4" />
      {isPending ? 'Cargando...' : 'Cargar Datos Iniciales'}
    </Button>
  );
}
