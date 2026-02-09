import RoomGrid from '@/components/dashboard/RoomGrid';
import SeedDataButton from '@/components/SeedDataButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getRooms } from '@/lib/actions/room.actions';

export default async function DashboardPage() {
  const rooms = await getRooms();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Room Dashboard</CardTitle>
          <CardDescription>
            Live overview of all rooms. Click a room to manage it.
          </CardDescription>
        </CardHeader>
        {rooms.length === 0 && (
          <CardContent>
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <h3 className="text-lg font-medium text-muted-foreground">No rooms found.</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Seed your database with initial data to get started.
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
