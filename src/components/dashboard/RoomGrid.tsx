'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, where, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Room, Stay } from '@/types';
import RoomCard from './RoomCard';
import { Skeleton } from '../ui/skeleton';
import { playNotificationSound } from '@/lib/sound';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import ExtendStayDialog from '../room-detail/ExtendStayDialog';

interface RoomGridProps {
  initialRooms: Room[];
}

export default function RoomGrid({ initialRooms }: RoomGridProps) {
  const { firestore } = useFirebase();
  const [overdueRooms, setOverdueRooms] = useState<Set<string>>(new Set());
  const notifiedOverdueRooms = useRef(new Set<string>());
  const { toast } = useToast();

  const roomsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'rooms'));
  }, [firestore]);
  const { data: rooms, isLoading: isLoadingRooms } = useCollection<Room>(roomsQuery);

  const activeStaysQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'stays'), where('checkOut', '==', null));
  }, [firestore]);
  const { data: activeStays, isLoading: isLoadingStays } = useCollection<Stay>(activeStaysQuery);
  
  const sortedRooms = useMemo(() => {
      return rooms?.slice().sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })) || [];
  }, [rooms]);

  useEffect(() => {
    const checkOverdueStays = () => {
      if (!activeStays || !rooms) return;

      const now = new Date();
      const latestOverdueRooms = new Set<string>();
      for (const stay of activeStays) {
        if (stay.expectedCheckOut.toDate() < now) {
          latestOverdueRooms.add(stay.roomId);
        }
      }
      
      // Sync notified set: remove rooms that are no longer overdue
      notifiedOverdueRooms.current.forEach(roomId => {
        if (!latestOverdueRooms.has(roomId)) {
            notifiedOverdueRooms.current.delete(roomId);
        }
      });

      const newlyOverdue = [...latestOverdueRooms].filter(id => !notifiedOverdueRooms.current.has(id));
      
      if (newlyOverdue.length > 0) {
        playNotificationSound();
        newlyOverdue.forEach(roomId => {
            notifiedOverdueRooms.current.add(roomId);
            const room = rooms.find(r => r.id === roomId);
            const stay = activeStays.find(s => s.roomId === roomId);
            if (room && stay) {
                toast({
                    variant: 'destructive',
                    title: `Habitación ${room.number} Vencida`,
                    description: `La estancia de ${stay.guestName} ha terminado. Gestione la estancia.`,
                    duration: Infinity,
                    action: (
                        <ExtendStayDialog room={room} stay={stay}>
                            <ToastAction altText="Gestionar">Gestionar</ToastAction>
                        </ExtendStayDialog>
                    )
                });
            }
        });
      }

      setOverdueRooms(prevOverdueRooms => {
        if (latestOverdueRooms.size === prevOverdueRooms.size && [...latestOverdueRooms].every(id => prevOverdueRooms.has(id))) {
          return prevOverdueRooms;
        }
        return latestOverdueRooms;
      });
    };

    const intervalId = setInterval(checkOverdueStays, 30 * 1000); // Check every 30 seconds
    checkOverdueStays();

    return () => clearInterval(intervalId);
  }, [activeStays, rooms, toast]);
  
  const isLoading = isLoadingRooms || isLoadingStays;

  if (isLoading && !rooms?.length) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {sortedRooms.map((room) => (
        <RoomCard key={room.id} room={room} isOverdue={overdueRooms.has(room.id)} />
      ))}
    </div>
  );
}
