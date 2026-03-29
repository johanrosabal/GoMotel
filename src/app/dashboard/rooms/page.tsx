'use client';

import RoomGrid from '@/components/dashboard/RoomGrid';
import SeedDataButton from '@/components/SeedDataButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AddRoomButton from '@/components/dashboard/AddRoomButton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CalendarPlus, Settings2, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { Room } from '@/types';

export default function DashboardRoomsPage() {
  const { firestore } = useFirebase();
  
  const roomsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'rooms'));
  }, [firestore]);
  
  const { data: rooms, isLoading: loading } = useCollection<Room>(roomsQuery);

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
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest animate-pulse">
              <Sparkles className="h-3 w-3" />
              Vista en Tiempo Real
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white flex items-center gap-3">
                <Settings2 className="h-8 w-8 text-primary" />
                Control de Habitaciones
              </h1>
              <p className="text-slate-400 mt-2 max-w-xl text-lg font-medium leading-relaxed">
                Gestione la disponibilidad y el estado de sus suites desde un centro de mando unificado y elegante.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button asChild variant="secondary" className="rounded-full font-black uppercase tracking-widest text-[10px] h-12 px-6 border border-white/10 shadow-xl" id="page-button-1">
              <Link href="/reservations" id="page-link-ir-a-reservaciones">
                <CalendarPlus className="mr-2 h-4 w-4 text-primary" />
                Ir a Reservaciones
              </Link>
            </Button>
            <AddRoomButton />
          </div>
        </div>

        <Card className="bg-slate-950/40 backdrop-blur-3xl border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] rounded-[2.5rem] overflow-hidden border-t-white/20">
          <CardHeader className="border-b border-white/5 py-8 px-8">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-black uppercase italic tracking-tight text-white">Directorio de Suites</CardTitle>
                <CardDescription className="text-slate-400 font-medium">
                  Haga clic en una habitación para ver detalles y administrar su estado actual.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-8">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : rooms.length === 0 ? (
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
      </motion.div>
    </div>
  );
}
