'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import type { Room, Stay } from '@/types';
import RoomCard from './RoomCard';
import { Skeleton } from '../ui/skeleton';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';

export default function RoomGrid() {
  const { firestore } = useFirebase();
  const [overdueRoomIds, setOverdueRoomIds] = useState<Set<string>>(new Set());

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
      if (!activeStays) return;

      const now = new Date();
      const latestOverdueRoomIds = new Set<string>();
      for (const stay of activeStays) {
        if (stay.expectedCheckOut.toDate() < now) {
          latestOverdueRoomIds.add(stay.roomId);
        }
      }
      
      setOverdueRoomIds(prevOverdueRoomIds => {
        if (latestOverdueRoomIds.size === prevOverdueRoomIds.size && [...latestOverdueRoomIds].every(id => prevOverdueRoomIds.has(id))) {
          return prevOverdueRoomIds;
        }
        return latestOverdueRoomIds;
      });
    };

    // Check once on load and then set an interval
    checkOverdueStays();
    const intervalId = setInterval(checkOverdueStays, 30 * 1000); // Check every 30 seconds

    return () => clearInterval(intervalId);
  }, [activeStays]);
  
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
        <RoomCard key={room.id} room={room} isOverdue={overdueRoomIds.has(room.id)} />
      ))}
    </div>
  );
}
