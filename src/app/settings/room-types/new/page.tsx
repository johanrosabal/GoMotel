import RoomTypeForm from '@/components/settings/room-types/RoomTypeForm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function NewRoomTypePage() {
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="flex items-center gap-4">
         <Button asChild variant="outline" size="icon">
            <Link href="/settings/room-types">
              <ArrowLeft />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Añadir Nuevo Tipo de Habitación</h1>
          <p className="text-muted-foreground">Añada un nuevo tipo de habitación a su sistema.</p>
        </div>
      </div>
      <RoomTypeForm />
    </div>
  );
}
