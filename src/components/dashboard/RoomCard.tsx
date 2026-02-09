import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Link href={`/rooms/${room.id}`} className="block">
      <Card className={cn("hover:shadow-lg transition-shadow duration-200 border-l-4", color)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">
            {room.number}
          </CardTitle>
          <Icon className="h-6 w-6 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <StatusBadge status={room.status} />
        </CardContent>
      </Card>
    </Link>
  );
}
