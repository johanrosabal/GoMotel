import RoomTypesTable from '@/components/settings/room-types/RoomTypesTable';
import AddRoomTypeButton from '@/components/settings/room-types/AddRoomTypeButton';
import { getRoomTypes } from '@/lib/actions/roomType.actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function RoomTypesPage() {
  const initialRoomTypes = await getRoomTypes();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Tipos de Habitación</CardTitle>
                    <CardDescription>
                    Añada, edite o elimine los tipos de habitación para su motel.
                    </CardDescription>
                </div>
                <AddRoomTypeButton />
            </div>
        </CardHeader>
        <CardContent>
            <RoomTypesTable initialRoomTypes={initialRoomTypes} />
        </CardContent>
      </Card>
    </div>
  );
}
