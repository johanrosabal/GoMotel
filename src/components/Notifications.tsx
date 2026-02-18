'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Room, Reservation } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, BedDouble, Sparkles } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from './ui/scroll-area';

export default function Notifications() {
  const { firestore } = useFirebase();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000); // Rerender every 30s
    return () => clearInterval(timer);
  }, []);

  // Query for rooms that need cleaning
  const cleaningRoomsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'rooms'), where('status', '==', 'Cleaning'));
  }, [firestore]);
  const { data: cleaningRooms, isLoading: isLoadingCleaningRooms } = useCollection<Room>(cleaningRoomsQuery);

  // Query for reservations that are currently checked-in
  const checkedInReservationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'reservations'), where('status', '==', 'Checked-in'));
  }, [firestore]);
  const { data: checkedInReservations, isLoading: isLoadingCheckedIn } = useCollection<Reservation>(checkedInReservationsQuery);

  // Now, calculate overdue rooms from the checked-in reservations
  const overdueReservations = useMemo(() => {
    if (!checkedInReservations) {
      return [];
    }
    return checkedInReservations.filter(res => res.checkOutDate.toDate() < now);
  }, [checkedInReservations, now]);

  const totalNotifications = (overdueReservations?.length || 0) + (cleaningRooms?.length || 0);
  const isLoading = isLoadingCleaningRooms || isLoadingCheckedIn;


  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalNotifications > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 justify-center p-0 text-xs animate-pulse"
            >
              {totalNotifications}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Notificaciones</h4>
            <p className="text-sm text-muted-foreground">
              Resumen de estados importantes de habitaciones.
            </p>
          </div>
          <Separator />
          {isLoading ? (
             <p className="text-sm text-muted-foreground text-center">Cargando notificaciones...</p>
          ) : totalNotifications === 0 ? (
            <p className="text-sm text-muted-foreground text-center">No hay notificaciones nuevas.</p>
          ) : (
            <ScrollArea className="max-h-80">
              <div className="space-y-4">
                {overdueReservations.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                        <BedDouble className="h-4 w-4" />
                        Estancias Vencidas ({overdueReservations.length})
                    </p>
                    <div className="space-y-1">
                      {overdueReservations.map(res => (
                        <Link key={res.id} href={`/rooms/${res.roomId}`} passHref>
                          <div className="block text-sm p-2 rounded-md hover:bg-accent cursor-pointer">
                              Habitación <span className="font-bold">{res.roomNumber}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                 {cleaningRooms && cleaningRooms.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-yellow-600 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Limpieza Requerida ({cleaningRooms.length})
                    </p>
                     <div className="space-y-1">
                      {cleaningRooms.map(room => (
                        <Link key={room.id} href={`/rooms/${room.id}`} passHref>
                          <div className="block text-sm p-2 rounded-md hover:bg-accent cursor-pointer">
                             Habitación <span className="font-bold">{room.number}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
