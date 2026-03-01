'use client';

import React, { useState, useEffect } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [time, setNow] = useState(new Date());

  const servicesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'services'), where('isActive', '==', true), orderBy('name')) : null, 
    [firestore]
  );
  const { data: services } = useCollection<Service>(servicesQuery);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!services || services.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % services.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [services]);

  const currentService = services?.[currentIndex];

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden font-sans relative">
      {/* Background Slideshow */}
      <AnimatePresence mode="wait">
        {currentService && (
          <motion.div
            key={currentService.id}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute inset-0 z-0"
          >
            {currentService.imageUrl ? (
              <div 
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url(${currentService.imageUrl})` }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-900 via-purple-900 to-black" />
            )}
            {/* Multi-layered overlays for depth and contrast */}
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main UI Layer */}
      <div className="relative z-10 h-full w-full flex flex-col p-16 lg:p-24 justify-between">
        
        {/* Header: Brand & Time */}
        <div className="flex justify-between items-start animate-in fade-in slide-in-from-top-10 duration-1000">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center shadow-2xl shadow-primary/40 rotate-3">
              <UtensilsIcon className="h-10 w-10 text-white" />
            </div>
            <div className="space-y-1">
              <h2 className="text-4xl font-black tracking-tighter uppercase">Go Motel</h2>
              <p className="text-primary font-black tracking-[0.3em] text-sm uppercase">Room Service 24/7</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-2xl px-8 py-4 rounded-[2rem] border border-white/10 shadow-2xl">
            <Clock className="h-6 w-6 text-primary" />
            <span className="text-3xl font-black tabular-nums tracking-tighter">
              {time.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Center: Hero Product Info */}
        <AnimatePresence mode="wait">
          {currentService && (
            <motion.div
              key={currentService.id + '-info'}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="max-w-[90%] space-y-10"
            >
              <div className="space-y-4">
                <Badge className="bg-primary text-white font-black px-6 py-2 rounded-full text-lg uppercase tracking-[0.2em] shadow-xl shadow-primary/20">
                  {currentService.category === 'Food' ? 'Deliciosa Comida' : 
                   currentService.category === 'Beverage' ? 'Refrescante Bebida' : 'Cuidado Personal'}
                </Badge>
                <h1 className="text-[7rem] font-black text-white uppercase tracking-tighter leading-[0.85] drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
                  {currentService.name}
                </h1>
              </div>

              <div className="flex items-center gap-12">
                <div className="bg-white/10 backdrop-blur-3xl border border-white/20 p-8 rounded-[3rem] shadow-2xl">
                  <p className="text-primary font-black text-xl uppercase tracking-widest mb-1">Precio Especial</p>
                  <p className="text-7xl font-black tracking-tighter">{formatCurrency(currentService.price)}</p>
                </div>
                <div className="space-y-2 max-w-xl">
                  <p className="text-2xl text-white/80 font-medium leading-relaxed italic">
                    {currentService.description || "Disponible para entrega inmediata en su habitación. Calidad premium garantizada."}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer: Dynamic Progress & Instructions */}
        <div className="flex items-end justify-between border-t border-white/10 pt-12 animate-in fade-in slide-in-from-bottom-10 duration-1000">
          <div className="flex items-center gap-8">
            <div className="p-6 bg-white rounded-[2rem] text-black shadow-2xl flex items-center gap-6">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                <SmartphoneIcon className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Pide desde tu móvil</p>
                <p className="text-xl font-black uppercase tracking-tighter">Escanea el Código QR</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            {services?.slice(0, 8).map((_, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "h-2 rounded-full transition-all duration-1000",
                  idx === currentIndex ? "w-16 bg-primary" : "w-2 bg-white/20"
                )} 
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function UtensilsIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
    </svg>
  );
}

function SmartphoneIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>
    </svg>
  );
}

function Badge({ children, className }: any) {
  return (
    <div className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", className)}>
      {children}
    </div>
  );
}