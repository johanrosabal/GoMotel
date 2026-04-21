'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, Timestamp } from 'firebase/firestore';
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
  const { data: activeStays, isLoading: isLoadingActiveStays } = useCollection<Stay>(activeStaysQuery);

  const startOfDay = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const closedStaysQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'stays'),
      where('checkOut', '>=', Timestamp.fromDate(startOfDay))
    );
  }, [firestore, startOfDay]);
  const { data: closedStays } = useCollection<Stay>(closedStaysQuery);

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'invoices'),
      where('createdAt', '>=', Timestamp.fromDate(startOfDay))
    );
  }, [firestore, startOfDay]);

  const { data: dailyInvoices, isLoading: isLoadingInvoices } = useCollection<any>(invoicesQuery);
  
  const sortedRooms = useMemo(() => {
      return rooms?.slice().sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })) || [];
  }, [rooms]);

  const allStaysToday = useMemo(() => {
    const stays = [...(activeStays || []), ...(closedStays || [])];
    // Deduplicate just in case
    const uniqueStays = new Map<string, Stay>();
    stays.forEach(s => uniqueStays.set(s.id, s));
    return Array.from(uniqueStays.values());
  }, [activeStays, closedStays]);

  const staysByRoomId = useMemo(() => {
    if (!activeStays) return new Map<string, Stay>();
    return new Map(activeStays.map(stay => [stay.roomId, stay]));
  }, [activeStays]);

  const dailyIncomeByRoomId = useMemo(() => {
    if (!dailyInvoices) return new Map<string, number>();
    const incomeMap = new Map<string, number>();
    
    dailyInvoices.forEach((invoice: any) => {
      if (invoice.status === 'Pagada') {
        let roomId = invoice.roomId;
        
        // Try to find the roomId if missing
        if (!roomId && invoice.stayId) {
          const stay = allStaysToday.find(s => s.id === invoice.stayId);
          if (stay) roomId = stay.roomId;
        }

        if (!roomId && invoice.roomNumber) {
          const room = rooms?.find(r => r.number === invoice.roomNumber);
          if (room) roomId = room.id;
        }

        if (roomId) {
          const current = incomeMap.get(roomId) || 0;
          incomeMap.set(roomId, current + (invoice.total || 0));
        }
      }
    });
    return incomeMap;
  }, [dailyInvoices, allStaysToday, rooms]);

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
  
  const isLoading = isLoadingRooms || isLoadingActiveStays || isLoadingInvoices;

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
      {sortedRooms.map((room) => {
        const stay = staysByRoomId.get(room.id);
        const dailyIncome = dailyIncomeByRoomId.get(room.id) || 0;
        return (
            <RoomCard 
                key={room.id} 
                room={room} 
                stay={stay}
                dailyIncome={dailyIncome}
                isOverdue={overdueRoomIds.has(room.id)} />
        );
      })}
    </div>
  );
}
