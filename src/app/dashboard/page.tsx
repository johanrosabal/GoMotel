import RoomGrid from '@/components/dashboard/RoomGrid';
import SeedDataButton from '@/components/SeedDataButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getRooms } from '@/lib/actions/room.actions';
import { getRoomTypes } from '@/lib/actions/roomType.actions';
import AddRoomButton from '@/components/dashboard/AddRoomButton';

export default async function DashboardPage() {
  const rooms = await getRooms();
  const roomTypes = await getRoomTypes();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Panel de Habitaciones</CardTitle>
              <CardDescription>
                Vista en vivo de todas las habitaciones. Haga clic en una habitación para administrarla.
              </CardDescription>
            </div>
            <AddRoomButton roomTypes={roomTypes} />
          </div>
        </CardHeader>
        {rooms.length === 0 && (
          <CardContent>
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <h3 className="text-lg font-medium text-muted-foreground">No se encontraron habitaciones.</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Cargue su base de datos con datos iniciales para comenzar.
              </p>
              <SeedDataButton />
            </div>
          </CardContent>
        )}
      </Card>

      {rooms.length > 0 && <RoomGrid initialRooms={rooms} />}
    </div>
  );
}
