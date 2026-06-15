'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import CleaningReportsList from '@/components/cleaning/CleaningReportsList';

export default function CleaningReportsPage() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-neutral-950 overflow-hidden">
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
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white flex items-center gap-3">
                <ClipboardList className="h-6 w-6 sm:h-8 sm:w-8 text-amber-400" />
                Historial de Daños y Reportes
              </h1>
              <p className="text-slate-400 mt-2 max-w-xl text-lg font-medium leading-relaxed">
                Revise los reportes de daños o problemas generados durante el proceso de limpieza.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button asChild variant="secondary" className="rounded-full font-black uppercase tracking-widest text-[10px] h-12 px-6 border border-white/10 shadow-xl transition-all hover:scale-105 active:scale-95" id="cleaning-reports-button-volver" data-testid="cleaning-reports-back-button">
              <Link href="/cleaning" id="cleaning-reports-link-volver" data-testid="cleaning-reports-back-link">
                <ArrowLeft className="mr-2 h-4 w-4 text-amber-400" />
                Volver a Limpieza
              </Link>
            </Button>
          </div>
        </div>

        <Card className="bg-slate-950/40 backdrop-blur-3xl border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] rounded-[2.5rem] overflow-hidden border-t-white/20">
          <CardHeader className="border-b border-white/5 py-8 px-8">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-black uppercase italic tracking-tight text-white">Reportes</CardTitle>
                <CardDescription className="text-slate-400 font-medium">
                  Lista de reportes en el historial.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-8">
            <CleaningReportsList />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
