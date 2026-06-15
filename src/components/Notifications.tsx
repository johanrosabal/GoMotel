'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { collection, query, where } from 'firebase/firestore';
import type { Room, Reservation, Order } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarClock, LogIn, AlertTriangle, Ban, ChevronRight, UserX, XCircle, Loader2, Volume2, Bell, BedDouble, Sparkles, VolumeX, Soup, Receipt } from 'lucide-react';
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
  const prevOrdersCount = useRef(0);


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

  // Query for reservations that are currently checked-in or confirmed
  const checkedInReservationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'reservations'), where('status', 'in', ['Checked-in', 'Confirmed']));
  }, [firestore]);
  const { data: checkedInReservations, isLoading: isLoadingCheckedIn } = useCollection<Reservation>(checkedInReservationsQuery);

  const overdueStays = useMemo(() => {
    if (!checkedInReservations) return [];
    return checkedInReservations.filter(res => res.status === 'Checked-in' && res.checkOutDate.toDate() < now);
  }, [checkedInReservations, now]);

  const overdueArrivals = useMemo(() => {
    if (!checkedInReservations) return [];
    return checkedInReservations.filter(res => res.status === 'Confirmed' && res.checkInDate.toDate() < now);
  }, [checkedInReservations, now]);

  const overdueReservations = useMemo(() => [...overdueStays, ...overdueArrivals], [overdueStays, overdueArrivals]);

  // Query for pending orders from rooms (Room Service)
  const pendingOrdersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'orders'), 
      where('status', '==', 'Pendiente'),
      where('locationType', '==', 'Stay')
    );
  }, [firestore]);
  const { data: pendingOrders, isLoading: isLoadingPendingOrders } = useCollection<Order>(pendingOrdersQuery);

  // Query for requested bills from rooms
  const requestedBillsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'orders'),
      where('billRequested', '==', true),
      where('locationType', '==', 'Stay'),
      where('paymentStatus', '==', 'Pendiente'),
      where('status', '!=', 'Cancelado')
    );
  }, [firestore]);
  const { data: requestedBills, isLoading: isLoadingRequestedBills } = useCollection<Order>(requestedBillsQuery);
  
  // Group requested bills by room to avoid duplicates in the UI
  const uniqueRequestedBills = useMemo(() => {
    if (!requestedBills) return [];
    const unique = new Map<string, Order>();
    requestedBills.forEach(o => {
      // Use locationId (which is the stayId or tableId) as the key
      if (!unique.has(o.locationId)) {
        unique.set(o.locationId, o);
      }
    });
    return Array.from(unique.values());
  }, [requestedBills]);

  // Trigger sound/pulse when a NEW room service order arrives
  useEffect(() => {
    if (pendingOrders && pendingOrders.length > prevOrdersCount.current) {
      if (!isAlertDisabled) {
        playNotificationSound('digital');
        setIsVisualPulseActive(true);
        setTimeout(() => setIsVisualPulseActive(false), 1000);
      }
    }
    prevOrdersCount.current = pendingOrders?.length || 0;
  }, [pendingOrders?.length, isAlertDisabled]);

  const totalNotifications = (overdueStays.length || 0) + (overdueArrivals.length || 0) + (cleaningRooms?.length || 0) + (pendingOrders?.length || 0) + (uniqueRequestedBills.length || 0);
  const isLoading = isLoadingCleaningRooms || isLoadingCheckedIn || isLoadingPendingOrders || isLoadingRequestedBills;

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
                {uniqueRequestedBills && uniqueRequestedBills.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-orange-600 flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Cuentas Solicitadas ({uniqueRequestedBills.length})
                    </p>
                    <div className="space-y-1">
                      {uniqueRequestedBills.map(order => (
                        <Link 
                          key={order.id} 
                          href={order.locationType === 'Stay' ? `/rooms/${order.roomId || order.locationId}` : `/pos?tableId=${order.locationId}`} 
                          passHref 
                          id="notifications-link-bills" 
                          data-testid="notifications-action-bill-link"
                        >
                          <div className="block text-sm p-2 rounded-md hover:bg-accent cursor-pointer flex justify-between items-center border-l-4 border-orange-500">
                            <span className="font-bold">{order.locationLabel || 'Habitación'}</span>
                            <span className="text-[9px] font-black bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded uppercase">Cobrar</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {pendingOrders && pendingOrders.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                      <Soup className="h-4 w-4" />
                      Pedidos de Habitación ({pendingOrders.length})
                    </p>
                    <div className="space-y-2">
                      {pendingOrders.map(order => (
                        <div key={order.id} className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 transition-all group/order">
                          <Link 
                            href={order.locationType === 'Stay' ? `/rooms/${order.roomId || order.locationId}` : `/pos?tableId=${order.locationId}`} 
                            className="flex justify-between items-center mb-2"
                          >
                            <span className="font-bold text-slate-200">{order.locationLabel || 'Habitación'}</span>
                            <span className="text-[9px] font-black opacity-30 tracking-widest group-hover/order:opacity-100 transition-opacity">#{order.id.slice(-4).toUpperCase()}</span>
                          </Link>
                          
                          <div className="flex gap-2">
                            {(order.kitchenStatus === 'Pendiente' || order.kitchenStatus === 'En preparación' || order.items?.some(i => i.category === 'Food' && i.status !== 'Entregado' && i.status !== 'Cancelado')) && (
                              <Link 
                                href="/kitchen" 
                                className="text-[8px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                              >
                                Cocina
                              </Link>
                            )}
                            {(order.barStatus === 'Pendiente' || order.barStatus === 'En preparación' || order.items?.some(i => i.category === 'Beverage' && i.status !== 'Entregado' && i.status !== 'Cancelado')) && (
                              <Link 
                                href="/bar" 
                                className="text-[8px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                              >
                                Bar
                              </Link>
                            )}
                            {(order.articlesStatus === 'Pendiente' || order.articlesStatus === 'En preparación' || order.items?.some(i => i.category === 'Article' && i.status !== 'Entregado' && i.status !== 'Cancelado')) && (
                              <Link 
                                href="/articles" 
                                className="text-[8px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full font-black uppercase tracking-widest hover:bg-purple-500 hover:text-white transition-all shadow-sm"
                              >
                                Artículos
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {overdueStays.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                      <BedDouble className="h-4 w-4" />
                      Estancias Vencidas ({overdueStays.length})
                    </p>
                    <div className="space-y-1">
                      {overdueStays.map(res => (
                        <Link key={res.id} href={`/rooms/${res.roomId}`} passHref id="notifications-link-1" data-testid="notifications-action-room-link">
                          <div className="block text-sm p-2 rounded-md hover:bg-accent cursor-pointer">
                            Habitación <span className="font-bold">{res.roomNumber}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {overdueArrivals.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-orange-500 flex items-center gap-2">
                      <CalendarClock className="h-4 w-4" />
                      Clientes No Llegaron ({overdueArrivals.length})
                    </p>
                    <div className="space-y-1">
                      {overdueArrivals.map(res => (
                        <Link key={res.id} href="/reservations" passHref id="notifications-link-arrivals" data-testid="notifications-action-arrivals-link">
                          <div className="block text-sm p-2 rounded-md hover:bg-accent cursor-pointer flex justify-between items-center">
                            <span>Hab. <span className="font-bold">{res.roomNumber}</span> - {res.guestName}</span>
                            <span className="text-[9px] font-black bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded uppercase">No llegó</span>
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
