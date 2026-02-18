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
import { VolumeX } from 'lucide-react';

export default function RoomGrid() {
  const { firestore } = useFirebase();
  const { toast, dismiss } = useToast();

  const [overdueRooms, setOverdueRooms] = useState<Set<string>>(new Set());
  const [isAlarmSilenced, setIsAlarmSilenced] = useState(false);
  
  const alarmToastId = useRef<string | null>(null);
  const soundIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      const latestOverdueRooms = new Set<string>();
      for (const stay of activeStays) {
        if (stay.expectedCheckOut.toDate() < now) {
          latestOverdueRooms.add(stay.roomId);
        }
      }
      
      setOverdueRooms(prevOverdueRooms => {
        if (latestOverdueRooms.size === prevOverdueRooms.size && [...latestOverdueRooms].every(id => prevOverdueRooms.has(id))) {
          return prevOverdueRooms;
        }
        return latestOverdueRooms;
      });
    };

    const intervalId = setInterval(checkOverdueStays, 30 * 1000);
    checkOverdueStays();

    return () => clearInterval(intervalId);
  }, [activeStays]);

  useEffect(() => {
    const hasOverdueRooms = overdueRooms.size > 0;

    if (hasOverdueRooms && !isAlarmSilenced) {
      if (!soundIntervalRef.current) {
        soundIntervalRef.current = setInterval(() => {
          playNotificationSound();
        }, 3000);
      }
    } else {
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
        soundIntervalRef.current = null;
      }
    }

    return () => {
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
      }
    };
  }, [overdueRooms.size, isAlarmSilenced]);

  useEffect(() => {
    const hasOverdueRooms = overdueRooms.size > 0;

    if (hasOverdueRooms) {
      if (!alarmToastId.current) {
        const newToastId = `alarm-${Date.now()}`;
        alarmToastId.current = newToastId;
        toast({
          id: newToastId,
          variant: 'destructive',
          title: '¡Alerta de Estancia Vencida!',
          description: `${overdueRooms.size} habitación(es) ha(n) vencido.`,
          duration: Infinity,
          action: (
            <ToastAction altText="Silenciar" onClick={() => setIsAlarmSilenced(true)}>
              <VolumeX className="mr-2 h-4 w-4" />
              Silenciar
            </ToastAction>
          ),
        });
      }
    } else {
      if (alarmToastId.current) {
        dismiss(alarmToastId.current);
        alarmToastId.current = null;
      }
      if (isAlarmSilenced) {
        setIsAlarmSilenced(false);
      }
    }
  }, [overdueRooms.size, toast, dismiss, isAlarmSilenced]);
  
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
