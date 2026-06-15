'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Brush, ArrowLeft, ClipboardList } from 'lucide-react';
import CleaningQueuePage from '@/components/cleaning/CleaningQueuePage';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function CleaningRootPage() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-neutral-950 overflow-hidden" data-testid="cleaning-root-container">
      {/* Cinematic Background */}
      <div className="fixed inset-0 z-0">
        <Image 
          src="/motel_premium_room_1773958120043.png" 
          alt="Cinematic Background" 
          fill 
          className="object-cover opacity-60 scale-105"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/50 to-black/95" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="container relative z-10 py-6 sm:py-8 lg:py-12 space-y-8"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-widest shadow-[0_0_10px_rgba(251,191,36,0.1)]">
              <Sparkles className="h-3 w-3" />
              Estado Renovado
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white flex items-center gap-3">
                <Brush className="h-6 w-6 sm:h-8 sm:w-8 text-amber-400" />
                Módulo de Limpieza
              </h1>
              <p className="text-slate-400 mt-2 max-w-xl text-lg font-medium leading-relaxed">
                Supervise y actualice el estado de las suites para asegurar la máxima calidad en cada estancia.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="rounded-full font-black uppercase tracking-widest text-[10px] h-12 px-6 border-amber-500/50 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 hover:text-white shadow-[0_0_15px_rgba(251,191,36,0.15)] transition-all hover:scale-105 active:scale-95" id="cleaning-button-reportes">
              <Link href="/cleaning/reports" id="cleaning-link-reportes">
                <ClipboardList className="mr-2 h-4 w-4" />
                Reportes de Daños
              </Link>
            </Button>
            <Button asChild variant="secondary" className="rounded-full font-black uppercase tracking-widest text-[10px] h-12 px-6 border border-white/10 shadow-xl transition-all hover:scale-105 active:scale-95" id="cleaning-button-volver" data-testid="cleaning-back-button">
              <Link href="/dashboard/rooms" id="cleaning-link-volver" data-testid="cleaning-back-link">
                <ArrowLeft className="mr-2 h-4 w-4 text-amber-400" />
                Volver al Panel
              </Link>
            </Button>
          </div>
        </div>

        <Card className="bg-slate-950/40 backdrop-blur-3xl border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] rounded-[2.5rem] overflow-hidden border-t-white/20">
          <CardHeader className="border-b border-white/5 py-8 px-8">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-black uppercase italic tracking-tight text-white">Cola de Trabajo</CardTitle>
                <CardDescription className="text-slate-400 font-medium">
                  Habitaciones pendientes de preparación y mantenimiento.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-8">
            <CleaningQueuePage />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
