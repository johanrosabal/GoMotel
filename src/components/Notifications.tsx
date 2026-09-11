'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { useUserProfile } from '@/hooks/use-user-profile';
import { collection, query, where } from 'firebase/firestore';
import type { Room, Reservation, Order, Stay, UserRole } from '@/types';
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
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

  // Query for all rooms to validate existing rooms and cleaning status
  const roomsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'rooms'));
  }, [firestore]);
  const { data: allRooms, isLoading: isLoadingRooms } = useCollection<Room>(roomsQuery);

  const cleaningRooms = useMemo(() => {
    if (!allRooms) return [];
    return allRooms.filter(room => room.status === 'Cleaning');
  }, [allRooms]);

  const validRoomIds = useMemo(() => {
    return new Set((allRooms || []).map(r => r.id));
  }, [allRooms]);

  // Query for active stays (occupied rooms) to accurately detect overdue stays
  const activeStaysQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'stays'), where('checkOut', '==', null));
  }, [firestore]);
  const { data: activeStays, isLoading: isLoadingActiveStays } = useCollection<Stay>(activeStaysQuery);

  // Query for confirmed reservations that have not checked in to detect overdue arrivals
  const confirmedReservationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'reservations'), where('status', '==', 'Confirmed'));
  }, [firestore]);
  const { data: confirmedReservations, isLoading: isLoadingConfirmedReservations } = useCollection<Reservation>(confirmedReservationsQuery);

  const overdueStays = useMemo(() => {
    if (!activeStays) return [];
    return activeStays.filter(stay => 
      stay.expectedCheckOut && 
      typeof stay.expectedCheckOut.toDate === 'function' && 
      stay.expectedCheckOut.toDate() < now &&
      (!allRooms || validRoomIds.has(stay.roomId))
    );
  }, [activeStays, now, allRooms, validRoomIds]);

  const overdueArrivals = useMemo(() => {
    if (!confirmedReservations) return [];
    return confirmedReservations.filter(res => 
      res.status === 'Confirmed' && 
      res.checkInDate && 
      typeof res.checkInDate.toDate === 'function' && 
      res.checkInDate.toDate() < now &&
      (!allRooms || validRoomIds.has(res.roomId))
    );
  }, [confirmedReservations, now, allRooms, validRoomIds]);

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

  const validPendingOrders = useMemo(() => {
    if (!pendingOrders) return [];
    return pendingOrders.filter(order => {
      if (order.locationType === 'Stay' && allRooms && order.roomId) {
        return validRoomIds.has(order.roomId);
      }
      return true;
    });
  }, [pendingOrders, allRooms, validRoomIds]);

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
      if (o.locationType === 'Stay' && allRooms) {
        const roomId = o.roomId || o.locationId;
        if (roomId && !validRoomIds.has(roomId)) return;
      }
      // Use locationId (which is the stayId or tableId) as the key
      if (o.locationId && !unique.has(o.locationId)) {
        unique.set(o.locationId, o);
      }
    });
    return Array.from(unique.values());
  }, [requestedBills, allRooms, validRoomIds]);

  // Trigger sound/pulse when a NEW room service order arrives
  useEffect(() => {
    if (validPendingOrders && validPendingOrders.length > prevOrdersCount.current) {
      if (!isAlertDisabled) {
        playNotificationSound('digital');
        setIsVisualPulseActive(true);
        setTimeout(() => setIsVisualPulseActive(false), 1000);
      }
    }
    prevOrdersCount.current = validPendingOrders?.length || 0;
  }, [validPendingOrders?.length, isAlertDisabled]);

  const totalNotifications = (overdueStays.length || 0) + (overdueArrivals.length || 0) + (cleaningRooms?.length || 0) + (validPendingOrders?.length || 0) + (uniqueRequestedBills.length || 0);
  const isLoading = isLoadingRooms || isLoadingActiveStays || isLoadingConfirmedReservations || isLoadingPendingOrders || isLoadingRequestedBills;

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

        let title = '¡Alerta de Tiempo!';
        let description = '';
        if (overdueStays.length > 0 && overdueArrivals.length > 0) {
          title = '¡Estancias y Reservaciones Vencidas!';
          description = `${overdueStays.length} estancia(s) en suite vencida(s) y ${overdueArrivals.length} reservación(es) no ingresada(s).`;
        } else if (overdueStays.length > 0) {
          title = '¡Alerta de Estancia Vencida en Suite!';
          description = `${overdueStays.length} habitación(es) en suite ha(n) superado su tiempo límite.`;
        } else {
          title = '¡Cliente con Reservación No Llegó!';
          description = `${overdueArrivals.length} reservación(es) confirmada(s) debió(eron) haber ingresado.`;
        }

        toast({
          id: newToastId,
          variant: 'destructive',
          title,
          description,
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
  }, [overdueReservations.length, overdueStays.length, overdueArrivals.length, toast, dismiss, isAlarmSilenced, isAlertDisabled]);
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
                {validPendingOrders && validPendingOrders.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                      <Soup className="h-4 w-4" />
                      Pedidos de Habitación ({validPendingOrders.length})
                    </p>
                    <div className="space-y-2">
                      {validPendingOrders.map(order => (
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
                    <p className="text-xs font-bold text-rose-500 flex items-center gap-1.5 uppercase tracking-wider">
                      <BedDouble className="h-4 w-4 text-rose-500 animate-pulse" />
                      Estancias en Suite Vencidas ({overdueStays.length})
                    </p>
                    <div className="space-y-1.5">
                      {overdueStays.map(stay => (
                        <Link 
                          key={stay.id} 
                          href={`/rooms/${stay.roomId}`} 
                          passHref 
                          id={`notifications-link-stay-${stay.id}`}
                          data-testid="notifications-action-room-link"
                          className="block p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all group"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-rose-200 text-sm">Hab. {stay.roomNumber}</span>
                              <span className="text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded uppercase">
                                En Suite
                              </span>
                            </div>
                            <span className="text-[9px] font-black bg-rose-600 text-white px-2 py-0.5 rounded uppercase shadow-sm group-hover:scale-105 transition-transform">
                              Gestionar
                            </span>
                          </div>
                          <div className="mt-1 flex justify-between items-center text-[10px] text-slate-400">
                            <span className="truncate max-w-[130px] font-medium">{stay.guestName || 'Huésped actual'}</span>
                            {stay.expectedCheckOut?.toDate && (
                              <span className="text-rose-400 font-bold">
                                Venció: {format(stay.expectedCheckOut.toDate(), 'HH:mm', { locale: es })}
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {overdueArrivals.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-amber-500 flex items-center gap-1.5 uppercase tracking-wider">
                      <CalendarClock className="h-4 w-4 text-amber-500" />
                      Reservas Sin Ingresar ({overdueArrivals.length})
                    </p>
                    <div className="space-y-1.5">
                      {overdueArrivals.map(res => (
                        <Link 
                          key={res.id} 
                          href="/reservations" 
                          passHref 
                          id={`notifications-link-arrival-${res.id}`}
                          data-testid="notifications-action-arrivals-link"
                          className="block p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all group"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-amber-200 text-sm">Hab. {res.roomNumber}</span>
                              <span className="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase">
                                Reservación
                              </span>
                            </div>
                            <span className="text-[9px] font-black bg-amber-600 text-white px-2 py-0.5 rounded uppercase shadow-sm group-hover:scale-105 transition-transform">
                              Ver Reserva
                            </span>
                          </div>
                          <div className="mt-1 flex justify-between items-center text-[10px] text-slate-400">
                            <span className="truncate max-w-[130px] font-medium">{res.guestName || 'Cliente'}</span>
                            {res.checkInDate?.toDate && (
                              <span className="text-amber-400 font-bold">
                                Previsto: {format(res.checkInDate.toDate(), 'HH:mm', { locale: es })}
                              </span>
                            )}
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
