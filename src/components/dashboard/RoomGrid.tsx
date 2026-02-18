'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Room, Stay } from '@/types';
import RoomCard from './RoomCard';
import { Skeleton } from '../ui/skeleton';
import { playNotificationSound } from '@/lib/sound';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';

interface RoomGridProps {
  initialRooms: Room[];
}

export default function RoomGrid({ initialRooms }: RoomGridProps) {
  const { firestore } = useFirebase();
  const [overdueRooms, setOverdueRooms] = useState<Set<string>>(new Set());

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
      const newOverdueRooms = new Set<string>();
      let soundPlayed = false;

      for (const stay of activeStays) {
        if (stay.expectedCheckOut.toDate() < now) {
          newOverdueRooms.add(stay.roomId);
          // If the room just became overdue, play a sound
          if (!overdueRooms.has(stay.roomId) && !soundPlayed) {
            playNotificationSound();
            soundPlayed = true; // Play sound only once per interval check
          }
        }
      }
      
      setOverdueRooms(newOverdueRooms);
    };

    const intervalId = setInterval(checkOverdueStays, 60 * 1000); // Check every minute
    checkOverdueStays(); // Also check immediately on load

    return () => clearInterval(intervalId);
  }, [activeStays, overdueRooms]);
  
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
