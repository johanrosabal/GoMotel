'use client';

import React, { useState, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [time, setTime] = useState(new Date());

  const servicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'services'),
      where('isActive', '==', true),
      orderBy('name')
    );
  }, [firestore]);

  const { data: services, isLoading } = useCollection<Service>(servicesQuery);

  // Update Clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto Rotation: 8 seconds per slide
  useEffect(() => {
    if (!services || services.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % services.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [services]);

  if (isLoading || !services || services.length === 0) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-white/50 font-black uppercase tracking-[0.3em] text-xs">Cargando Menú Board...</p>
        </div>
      </div>
    );
  }

  const currentItem = services[currentIndex];

  return (
    <div className="h-screen w-full bg-black overflow-hidden relative font-sans select-none">
      {/* Dynamic Background Image with Ken Burns Effect */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentItem.id}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute inset-0 z-0"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 z-10" />
          <img
            src={currentItem.imageUrl || `https://picsum.photos/seed/${currentItem.id}/1920/1080`}
            alt={currentItem.name}
            className="w-full h-full object-cover"
          />
        </motion.div>
      </AnimatePresence>

      {/* Top Navigation / Info Bar */}
      <div className="absolute top-0 inset-x-0 z-20 p-12 flex justify-between items-start pointer-events-none">
        <div className="flex items-center gap-6">
          <div className="bg-primary px-8 py-3 rounded-full shadow-2xl shadow-primary/40 border border-white/20">
            <span className="text-2xl font-black text-white uppercase tracking-[0.2em]">MENÚ DIGITAL</span>
          </div>
          <div className="bg-white/10 backdrop-blur-xl px-8 py-3 rounded-full border border-white/10 flex items-center gap-4">
            <Clock className="h-6 w-6 text-primary" />
            <span className="text-2xl font-black text-white tracking-tighter">
              {time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
        
        {/* Recommendation Label Style McDonald's */}
        <div className="bg-yellow-400 px-10 py-4 rounded-3xl shadow-2xl rotate-3 border-4 border-white">
            <p className="text-black font-black text-xl uppercase tracking-tighter leading-none mb-1">RECOMENDADO</p>
            <p className="text-black/60 font-black text-sm uppercase tracking-widest leading-none">
                {currentItem.category === 'Food' ? 'PLATILLO DEL DÍA' : 'BEBIDA PREMIUM'}
            </p>
        </div>
      </div>

      {/* Main Content Info - Ultra-wide area */}
      <div className="absolute bottom-0 inset-x-0 z-20 p-16 md:p-24 lg:p-32 pointer-events-none">
        <div className="max-w-[90vw] space-y-8">
          <motion.div
            key={`info-${currentItem.id}`}
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="space-y-4"
          >
            <Badge className="bg-white/20 backdrop-blur-md text-white border-0 text-xl font-black uppercase tracking-[0.4em] px-8 py-2 rounded-2xl">
              {currentItem.category === 'Beverage' ? 'Bebida' : currentItem.category === 'Food' ? 'Comida' : 'Amenidad'}
            </Badge>
            <h1 className="text-[7rem] font-black text-white uppercase tracking-tighter leading-[0.85] drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
              {currentItem.name}
            </h1>
          </motion.div>

          <motion.div
            key={`price-${currentItem.id}`}
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="flex items-center gap-12"
          >
            <div className="bg-primary px-12 py-6 rounded-[2.5rem] shadow-2xl shadow-primary/50 border-4 border-white/20">
              <span className="text-7xl font-black text-white tracking-tighter">
                {formatCurrency(currentItem.price)}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-xl px-10 py-6 rounded-[2.5rem] border-2 border-white/10">
                <p className="text-white/60 font-black text-sm uppercase tracking-[0.3em] mb-1">DISPONIBILIDAD</p>
                <p className="text-white text-3xl font-black uppercase tracking-tighter">ORDENA DESDE TU MÓVIL</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Progress Bar (Time to next slide) */}
      <motion.div 
        key={`progress-${currentIndex}`}
        initial={{ width: "0%" }}
        animate={{ width: "100%" }}
        transition={{ duration: 8, ease: "linear" }}
        className="absolute bottom-0 left-0 h-3 bg-primary z-30 shadow-[0_-5px_20px_rgba(var(--primary),0.5)]"
      />

      {/* Side Counter */}
      <div className="absolute right-12 bottom-12 z-20 flex items-center gap-4 bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10">
        <span className="text-primary font-black text-2xl">{currentIndex + 1}</span>
        <div className="h-8 w-px bg-white/20" />
        <span className="text-white/40 font-black text-2xl">{services.length}</span>
      </div>
    </div>
  );
}
