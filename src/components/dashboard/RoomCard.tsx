'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import StatusBadge from './StatusBadge';
import type { Room } from '@/types';
import { BedDouble, Sparkles, Wrench, User, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUserProfile } from '@/hooks/use-user-profile';
import RoomActionsMenu from './RoomActionsMenu';

interface RoomCardProps {
  room: Room;
  isOverdue?: boolean;
}

const statusConfig = {
    Available: { icon: BedDouble, color: 'border-green-500' },
    Occupied: { icon: User, color: 'border-blue-500' },
    Cleaning: { icon: Sparkles, color: 'border-yellow-500' },
    Maintenance: { icon: Wrench, color: 'border-purple-500' },
    Overdue: { icon: AlertTriangle, color: 'border-destructive' }
}

export default function RoomCard({ room, isOverdue = false }: RoomCardProps) {
  const { userProfile } = useUserProfile();
  const currentStatus = isOverdue ? 'Overdue' : room.status;
  const { icon: Icon, color } = statusConfig[currentStatus];
  
  const [timeInStatus, setTimeInStatus] = useState('');

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    if (room.status === 'Cleaning' && room.statusUpdatedAt) {
      const update = () => {
        setTimeInStatus(formatDistanceToNowStrict(room.statusUpdatedAt.toDate(), { locale: es }));
      };
      update();
      intervalId = setInterval(update, 60000); // update every minute
    } else {
        setTimeInStatus('');
    }

    return () => clearInterval(intervalId);
  }, [room.status, room.statusUpdatedAt]);

  return (
    <div className="relative group/card h-full">
      {userProfile?.role === 'Administrador' && (
          <div className="absolute bottom-2 right-2 z-10 opacity-0 group-hover/card:opacity-100 transition-opacity">
            <RoomActionsMenu room={room} />
          </div>
      )}
      <Link href={`/rooms/${room.id}`} className="block h-full">
        <Card className={cn(
          "hover:shadow-lg transition-shadow duration-200 border-l-4 flex flex-col h-full",
          !isOverdue && color,
          isOverdue && "animate-overdue-pulse"
          )}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-2xl font-bold">
                {room.number}
              </CardTitle>
              <CardDescription className="text-xs font-semibold !mt-1">{room.roomTypeName || room.type}</CardDescription>
            </div>
            <Icon className={cn("h-6 w-6 text-muted-foreground", isOverdue && "text-destructive")} />
          </CardHeader>
          <CardContent className="mt-auto">
            <div className="flex justify-between items-center gap-2">
              <StatusBadge status={isOverdue ? 'Occupied' : room.status} isOverdue={isOverdue} />
              {room.status === 'Cleaning' && timeInStatus && (
                <div className="text-xs text-muted-foreground flex items-center gap-1" title={`Iniciado el ${room.statusUpdatedAt?.toDate().toLocaleString()}`}>
                  <Clock className="h-3 w-3" />
                  {timeInStatus}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
