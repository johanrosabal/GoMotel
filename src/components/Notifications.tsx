'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { collection, query, where } from 'firebase/firestore';
import type { Room, Reservation } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarClock, LogIn, AlertTriangle, Ban, ChevronRight, UserX, XCircle, Loader2, Volume2, Bell, BedDouble, Sparkles, VolumeX } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { playNotificationSound } from '@/lib/sound';
import { ToastAction } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export default function Notifications() {
  const { firestore } = useFirebase();
  const { toast, dismiss } = useToast();
  const { userProfile } = useUserProfile();
  const pathname = usePathname();
  const [now, setNow] = useState(new Date());
  const [isAlarmSilenced, setIsAlarmSilenced] = useState(false);
  const [isVisualPulseActive, setIsVisualPulseActive] = useState(false);

  // Disable alerts on specific pages: Landing, POS, and Public Screens
  // OR for specific roles like Vendedor POS, Cocina, and Contador
  const isAlertDisabled = useMemo(() => {
    const restrictedRoles: UserRole[] = ['Vendedor POS', 'Cocina', 'Contador'];
    return (
      pathname === '/' || 
      pathname === '/pos' || 
      pathname?.startsWith('/public/') ||
      (userProfile?.role && restrictedRoles.includes(userProfile.role))
    );
  }, [pathname, userProfile?.role]);

  const alarmToastId = useRef<string | null>(null);
  const soundIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // --- START: Alarm Logic ---
  useEffect(() => {
    const hasOverdue = overdueReservations.length > 0;

    if (hasOverdue && !isAlarmSilenced && !isAlertDisabled) {
      if (!soundIntervalRef.current) {
        // Start a persistent interval that won't be cleared unless the condition changes
        soundIntervalRef.current = setInterval(() => {
          playNotificationSound();
          setIsVisualPulseActive(true);
          setTimeout(() => setIsVisualPulseActive(false), 1000);
        }, 6000); 
      }
    } else {
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
        soundIntervalRef.current = null;
      }
    }

    return () => {
      // Only clear on component unmount or when dependencies change (hasOverdue/isAlarmSilenced/isAlertDisabled)
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
        soundIntervalRef.current = null;
      }
    };
  }, [overdueReservations.length > 0, isAlarmSilenced, isAlertDisabled]);

  useEffect(() => {
    const hasOverdue = overdueReservations.length > 0;

    if (hasOverdue && !isAlertDisabled) {
      if (!alarmToastId.current) {
        const newToastId = `alarm-${Date.now()}`;
        alarmToastId.current = newToastId;
        toast({
          id: newToastId,
          variant: 'destructive',
          title: '¡Alerta de Estancia Vencida!',
          description: `${overdueReservations.length} habitación(es) ha(n) vencido.`,
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
      // Reset silence state when there are no more overdue rooms
      if (isAlarmSilenced && !isAlertDisabled) {
        setIsAlarmSilenced(false);
      }
    }
  }, [overdueReservations.length, toast, dismiss, isAlarmSilenced, isAlertDisabled]);
  // --- END: Alarm Logic ---

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "relative transition-all duration-300",
            isVisualPulseActive && "scale-125 ring-4 ring-destructive/50 bg-destructive/20"
          )} 
          id="notifications-button-1" 
          data-testid="notifications-action-button"
        >
          <Bell className={cn("h-5 w-5", isVisualPulseActive && "animate-bounce text-destructive")} />
          {totalNotifications > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 justify-center p-0 text-xs shadow-lg shadow-destructive/20"
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
                        <Link key={res.id} href={`/rooms/${res.roomId}`} passHref id="notifications-link-1" data-testid="notifications-action-room-link">
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
                        <Link key={room.id} href={`/rooms/${room.id}`} passHref id="notifications-link-2" data-testid="notifications-action-room-link">
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

          <div className="pt-4 border-t border-white/5 space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-10 rounded-xl bg-white/5 border-white/10 hover:bg-primary/20 hover:text-primary font-black uppercase tracking-widest text-[9px] transition-all"
              onClick={() => {
                playNotificationSound('digital');
                setIsVisualPulseActive(true);
                setTimeout(() => setIsVisualPulseActive(false), 800);
              }}
              id="notifications-button-test-sound"
              data-testid="notifications-test-sound-button"
            >
              <Volume2 className="mr-2 h-3.5 w-3.5" />
              Probar Sonido de Alerta
            </Button>
            {overdueReservations.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-8 text-xs opacity-50 hover:opacity-100"
                onClick={() => setIsAlarmSilenced(!isAlarmSilenced)}
              >
                {isAlarmSilenced ? 'Reactivar Alerta' : 'Silenciar Alerta'}
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
