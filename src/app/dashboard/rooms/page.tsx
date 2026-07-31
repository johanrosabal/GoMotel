'use client';
import { useMemo, useState } from 'react';
import RoomGrid from '@/components/dashboard/RoomGrid';
import SeedDataButton from '@/components/SeedDataButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AddRoomButton from '@/components/dashboard/AddRoomButton';
import ExportRoomQRButton from '@/components/dashboard/ExportRoomQRButton';
import ExportRoomMenuQRButton from '@/components/dashboard/ExportRoomMenuQRButton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from 'next/link';
import { CalendarPlus, Settings2, Sparkles, UserPlus, TrendingUp, Users, Trophy, FileText, Clock, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useCollection, useFirebase, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { useEffect } from 'react';
import type { Room, Stay } from '@/types';
import AddClientDialog from '@/components/clients/AddClientDialog';
import EditRoomTopButton from '@/components/dashboard/EditRoomTopButton';

export default function DashboardRoomsPage() {
  const { firestore } = useFirebase();
  const { user, userProfile } = useUser();
  
  const roomsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'rooms'));
  }, [firestore]);
  
  const { data: rooms, isLoading: loading } = useCollection<Room>(roomsQuery);

  const startOfDay = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'invoices'),
      where('createdAt', '>=', Timestamp.fromDate(startOfDay))
    );
  }, [firestore, startOfDay]);

  const { data: dailyInvoices } = useCollection<any>(invoicesQuery);

  const staysQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'stays'),
      where('checkIn', '>=', Timestamp.fromDate(startOfDay))
    );
  }, [firestore, startOfDay]);

  const { data: dailyStays } = useCollection<Stay>(staysQuery);

  // Fetch active system users directly from Firestore
  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'users'),
      where('status', '==', 'Active')
    );
  }, [firestore]);

  const { data: systemUsers } = useCollection<any>(usersQuery);

  const [shiftFilter, setShiftFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');

  // Build clean users list strictly from systemUsers (users collection)
  const uniqueUsers = useMemo(() => {
    if (!systemUsers) return [];

    return systemUsers.map((u: any) => {
      const firstName = (u.firstName || '').trim();
      const lastName = (u.lastName || '').trim();
      const fullName = `${firstName} ${lastName}`.trim() || u.name || u.displayName || u.email || 'Usuario';
      const email = (u.email || '').trim().toLowerCase();

      return {
        id: u.id || email || fullName.toLowerCase(),
        name: fullName,
        role: u.role || 'Desconocido',
        email: u.email || '',
        firstName: firstName.toLowerCase(),
        lastName: lastName.toLowerCase()
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [systemUsers]);

  const totalSalesToday = useMemo(() => {
    if (!dailyStays) return 0;

    const selectedUser = userFilter !== 'all' ? uniqueUsers.find(u => u.id === userFilter || u.name === userFilter || u.email === userFilter) : null;

    return dailyStays
      .filter((stay: any) => {
        if (shiftFilter !== 'all') {
          const date = stay.checkIn?.toDate ? stay.checkIn.toDate() : new Date(stay.checkIn);
          const hour = date.getHours();
          if (shiftFilter === 'day') {
            if (hour < 6 || hour >= 18) return false;
          } else if (shiftFilter === 'night') {
            if (hour >= 6 && hour < 18) return false;
          }
        }
        
        if (selectedUser) {
          const creatorEmail = (stay.createdByEmail || '').trim().toLowerCase();
          const creatorName = (stay.createdBy || '').trim().toLowerCase();

          const targetEmail = selectedUser.email.trim().toLowerCase();
          const targetName = selectedUser.name.trim().toLowerCase();

          if (creatorEmail) {
            if (creatorEmail !== targetEmail) return false;
          } else {
            if (!creatorName) return false;
            const nameMatches = creatorName === targetName || creatorName.includes(targetName) || targetName.includes(creatorName);
            if (!nameMatches) return false;
          }
        }

        return true;
      })
      .reduce((acc: number, stay: any) => acc + (stay.pricePlanAmount || stay.total || stay.paymentAmount || 0), 0);
  }, [dailyStays, shiftFilter, userFilter, uniqueUsers]);

  // 1. Calculate Sales & Stays per User/Registrar for today using dailyStays
  const salesPerUserToday = useMemo(() => {
    const userSalesMap = new Map<string, { id: string; name: string; email: string; role: string; totalSales: number; count: number }>();

    uniqueUsers.forEach(u => {
      userSalesMap.set(u.id, {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        totalSales: 0,
        count: 0
      });
    });

    if (dailyStays) {
      dailyStays.forEach((stay: any) => {
        const regName = (stay.createdBy || '').trim();
        const regEmail = (stay.createdByEmail || '').trim().toLowerCase();
        const amount = stay.pricePlanAmount || stay.total || stay.paymentAmount || 0;

        let matchedUser = null;
        if (regEmail) {
          matchedUser = uniqueUsers.find(u => u.email.toLowerCase() === regEmail);
        }
        
        if (!matchedUser && regName) {
          const homonyms = uniqueUsers.filter(u => u.name.toLowerCase() === regName.toLowerCase());
          if (homonyms.length === 1) {
            matchedUser = homonyms[0];
          } else if (homonyms.length > 1) {
            const receptionUser = homonyms.find(u => 
              u.role?.toLowerCase().includes('recep') || u.email.toLowerCase().includes('live.com')
            );
            matchedUser = receptionUser || homonyms[0];
          }
        }

        if (matchedUser) {
          const entry = userSalesMap.get(matchedUser.id);
          if (entry) {
            entry.totalSales += amount;
            entry.count += 1;
          }
        } else if (regName) {
          const key = regName.toLowerCase();
          if (!userSalesMap.has(key)) {
            userSalesMap.set(key, {
              id: key,
              name: regName,
              email: regEmail,
              role: 'Desconocido',
              totalSales: amount,
              count: 1
            });
          } else {
            const entry = userSalesMap.get(key)!;
            entry.totalSales += amount;
            entry.count += 1;
          }
        }
      });
    }

    const ALLOWED_ROLES = ['administrador', 'administración', 'administracion', 'recepción', 'recepcion'];
    return Array.from(userSalesMap.values())
      .filter(u => ALLOWED_ROLES.includes((u.role || '').trim().toLowerCase()))
      .sort((a, b) => b.totalSales - a.totalSales);
  }, [dailyStays, uniqueUsers]);

  // 2. Top Requested Rooms Today
  const topRoomsToday = useMemo(() => {
    if (!dailyStays) return [];
    const counts: { [roomNumber: string]: number } = {};
    dailyStays.forEach(stay => {
      if (stay.roomNumber) {
        counts[stay.roomNumber] = (counts[stay.roomNumber] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([roomNumber, count]) => ({ roomNumber, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [dailyStays]);

  // 3. Stays Volume & Breakdown Today
  const staysVolumeToday = useMemo(() => {
    if (!dailyStays) return { total: 0, active: 0, completed: 0 };
    const total = dailyStays.length;
    const active = dailyStays.filter(s => !s.checkOut).length;
    const completed = dailyStays.filter(s => !!s.checkOut).length;
    return { total, active, completed };
  }, [dailyStays]);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-neutral-950 overflow-hidden">
      {/* Cinematic Background */}
      <div className="fixed inset-0 z-0">
        <Image 
          src="/dashboard_rooms.png" 
          alt="Cinematic Background" 
          fill 
          className="object-cover opacity-70 scale-105"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/40 to-black/90" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="container relative z-10 py-6 sm:py-8 lg:py-12 space-y-8"
      >
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest shadow-[0_0_10px_rgba(255,255,255,0.05)]">
                <Sparkles className="h-3 w-3" />
                Vista en Tiempo Real
              </div>
              <div className="flex items-center justify-between gap-8">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white flex items-center gap-3 whitespace-nowrap">
                  <Settings2 className="h-6 w-6 text-primary shrink-0" />
                  Control de Habitaciones
                </h1>
                <div className="hidden md:flex items-center gap-6 px-10 py-5 rounded-[2.5rem] bg-emerald-500/20 border-2 border-emerald-500/30 shadow-[0_0_35px_-5px_rgba(52,211,153,0.4)] backdrop-blur-2xl transition-all hover:bg-emerald-500/25 group/sales min-w-[320px]">
                  <div className="p-4 rounded-2xl bg-emerald-500/30 border border-emerald-500/40 shadow-inner group-hover/sales:animate-pulse shrink-0">
                    <TrendingUp className="h-8 w-8 text-emerald-300" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-[0.4em] leading-none opacity-90">Ventas Totales</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-white italic tracking-tighter tabular-nums drop-shadow-[0_0_20px_rgba(52,211,153,1)]">
                        ₡{totalSalesToday.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden md:block">
            <div className="flex gap-2 items-center">
              <ExportRoomQRButton rooms={rooms || []} />
              <ExportRoomMenuQRButton rooms={rooms || []} />
            </div>
            </div>
          </div>
          
          <p className="text-slate-400 max-w-xl text-lg font-medium leading-relaxed">
            Gestione la disponibilidad y el estado de sus suites desde un centro de mando unificado y elegante.
          </p>
        </div>        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Panel: Rendimiento y Estadísticas */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-6">
            {/* Panel: Estadísticas e Indicadores (Habitaciones Más Solicitadas + Volumen) */}
            <Card className="bg-slate-950/40 backdrop-blur-3xl border-white/10 shadow-2xl rounded-[2.5rem] p-6 space-y-6 border-t-white/20">
              {/* Habitaciones Más Solicitadas */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-400">Rendimiento</span>
                    <h3 className="text-sm font-black uppercase italic tracking-tight text-white">Habitaciones Más Solicitadas</h3>
                  </div>
                </div>

                <div className="space-y-2">
                  {topRoomsToday.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-3 text-center">Sin estancias registradas hoy</p>
                  ) : (
                    topRoomsToday.map((r, idx) => (
                      <div key={r.roomNumber} className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center shrink-0",
                            idx === 0 ? "bg-amber-500 text-black font-bold" : idx === 1 ? "bg-slate-300 text-black" : "bg-amber-800/50 text-amber-200"
                          )}>
                            #{idx + 1}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-white">Habitación {r.roomNumber}</p>
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-300">{r.count} {r.count === 1 ? 'estancia' : 'estancias'}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Volumen Total & Estado de Estancias */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Total Hoy</span>
                    <FileText className="h-4 w-4 text-purple-400" />
                  </div>
                  <p className="text-2xl font-black text-white italic font-mono">{staysVolumeToday.total}</p>
                  <p className="text-[9px] text-slate-500 font-medium">Estancias registradas</p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Activas</span>
                    <Clock className="h-4 w-4 text-emerald-400 animate-pulse" />
                  </div>
                  <p className="text-2xl font-black text-emerald-400 italic font-mono">{staysVolumeToday.active}</p>
                  <p className="text-[9px] text-slate-500 font-medium">En curso actualmente</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Side: Directorio de Suites */}
          <div className="lg:col-span-8 xl:col-span-9">
            <Card className="bg-slate-950/40 backdrop-blur-3xl border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] rounded-[2.5rem] overflow-hidden border-t-white/20">
              <CardHeader className="border-b border-white/5 py-6 px-6 sm:py-8 sm:px-8 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <CardTitle className="text-xl sm:text-2xl font-black uppercase italic tracking-tight text-white">Directorio de Suites</CardTitle>
                    <CardDescription className="text-slate-400 font-medium text-sm">
                      Haga clic en una habitación para ver detalles y administrar su estado actual.
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:gap-3 shrink-0">
                    <Button asChild variant="secondary" className="rounded-full font-black uppercase tracking-widest text-[10px] h-11 px-6 border border-white/10 shadow-xl" id="page-button-1" data-testid="rooms-action-button">
                      <Link href="/reservations" id="page-link-ir-a-reservaciones" data-testid="rooms-reservations-link">
                        <CalendarPlus className="mr-2 h-4 w-4 text-primary" />
                        Ir a Reservaciones
                      </Link>
                    </Button>
                    <EditRoomTopButton rooms={rooms || []} />
                    <AddRoomButton />
                  </div>
                </div>

                {/* Resumen de Ventas por Recepción (Solo Roles Administrador y Recepción) */}
                <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black uppercase italic tracking-tight text-white">Ventas por Recepción</h3>
                        <p className="text-[10px] font-medium text-slate-400">Registrado por (Hoy) • Administración y Recepción</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                      Hoy
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {salesPerUserToday.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-3 col-span-full">Sin datos de recepción hoy</p>
                    ) : (
                      salesPerUserToday.map(u => (
                        <div 
                          key={u.id}
                          onClick={() => setUserFilter(userFilter === u.id ? 'all' : u.id)}
                          className={cn(
                            "p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group",
                            userFilter === u.id 
                              ? "bg-emerald-500/15 border-emerald-500/40 shadow-lg shadow-emerald-500/10" 
                              : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                              {u.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{u.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">{u.email}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                  {u.role}
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium">{u.count} {u.count === 1 ? 'estancia' : 'estancias'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-black text-white italic tracking-tight font-mono">
                              ₡{u.totalSales.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Filter Bar */}
                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/5 mt-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Filtrar Ventas:</span>
                  <Select value={shiftFilter} onValueChange={setShiftFilter}>
                    <SelectTrigger className="h-9 text-xs bg-white/5 border-white/10 text-white rounded-xl font-bold w-[140px]">
                      <SelectValue placeholder="Turno" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todo el día</SelectItem>
                      <SelectItem value="day">Día (6AM-6PM)</SelectItem>
                      <SelectItem value="night">Noche (6PM-6AM)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={userFilter} onValueChange={setUserFilter}>
                    <SelectTrigger className="h-9 text-xs bg-white/5 border-white/10 text-white rounded-xl font-bold w-[180px]">
                      <SelectValue placeholder="Usuario">
                        {userFilter === 'all' ? 'Todos los Usuarios' : (uniqueUsers.find(u => u.id === userFilter || u.name === userFilter)?.name || userFilter)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="min-w-[460px] bg-slate-900/95 border-white/10 backdrop-blur-xl">
                      <SelectItem value="all">Todos los usuarios</SelectItem>
                      {uniqueUsers
                        .filter(u => ['administrador', 'administración', 'administracion', 'recepción', 'recepcion'].includes((u.role || '').trim().toLowerCase()))
                        .map(u => (
                          <SelectItem key={u.id} value={u.id} className="py-2 focus:bg-white/10">
                            <div className="grid grid-cols-[150px_100px_1fr] items-center gap-3 w-full text-xs">
                              <span className="font-bold truncate text-white">{u.name}</span>
                              <span className="text-[10px] text-emerald-400 font-semibold truncate bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 text-center">
                                {u.role || 'Sin Rol'}
                              </span>
                              <span className="text-[11px] text-slate-400 truncate text-right font-mono">{u.email}</span>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              
              <CardContent className="p-8">
                {loading ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />
                    ))}
                  </div>
                ) : !rooms || rooms.length === 0 ? (
                  <div className="text-center py-20 bg-black/20 rounded-[2rem] border border-white/5">
                    <h3 className="text-xl font-bold text-slate-300">No hay suites configuradas</h3>
                    <p className="text-sm text-slate-500 mt-2 mb-8">
                      Comience poblando la base de datos con suites de prueba.
                    </p>
                    <SeedDataButton />
                  </div>
                ) : (
                  <RoomGrid />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
