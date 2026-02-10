import RoomTypesTable from '@/components/settings/room-types/RoomTypesTable';
import { getRoomTypes } from '@/lib/actions/roomType.actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';

export default async function RoomTypesPage() {
  const initialRoomTypes = await getRoomTypes();

  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Tipos de Habitación</CardTitle>
                    <CardDescription>
                    Añada, edite o elimine los tipos de habitación para su motel.
                    </CardDescription>
                </div>
                <Button asChild size="sm">
                  <Link href="/settings/room-types/new">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Añadir Tipo de Habitación
                  </Link>
                </Button>
            </div>
        </CardHeader>
        <CardContent>
            <RoomTypesTable initialRoomTypes={initialRoomTypes} />
        </CardContent>
      </Card>
    </div>
  );
}
