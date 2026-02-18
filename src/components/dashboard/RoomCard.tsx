import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import StatusBadge from './StatusBadge';
import type { Room } from '@/types';
import { BedDouble, Sparkles, Wrench, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoomCardProps {
  room: Room;
}

const statusConfig = {
    Available: { icon: BedDouble, color: 'border-green-500' },
    Occupied: { icon: User, color: 'border-red-500' },
    Cleaning: { icon: Sparkles, color: 'border-blue-500' },
    Maintenance: { icon: Wrench, color: 'border-yellow-500' },
}

export default function RoomCard({ room }: RoomCardProps) {
  const { icon: Icon, color } = statusConfig[room.status];
  
  return (
    <Link href={`/rooms/${room.id}`} className="block h-full">
      <Card className={cn("hover:shadow-lg transition-shadow duration-200 border-l-4 flex flex-col h-full", color)}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-2xl font-bold">
              {room.number}
            </CardTitle>
            <CardDescription className="text-xs font-semibold !mt-1">{room.roomTypeName || room.type}</CardDescription>
          </div>
          <Icon className="h-6 w-6 text-muted-foreground" />
        </CardHeader>
        <CardContent className="mt-auto">
          <StatusBadge status={room.status} />
        </CardContent>
      </Card>
    </Link>
  );
}
