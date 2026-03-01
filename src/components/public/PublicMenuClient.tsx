'use client';

import { useState, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Service } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const CATEGORY_MAP: Record<string, string> = {
    'Food': 'Comida',
    'Beverage': 'Bebida',
    'Amenity': 'Amenidad',
};

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [now, setNow] = useState(new Date());

  const servicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'services'), where('isActive', '==', true));
  }, [firestore]);

  const { data: services, isLoading } = useCollection<Service>(servicesQuery);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (services && services.length > 0) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % services.length);
      }, 8000); // 8 seconds per slide
      return () => clearInterval(interval);
    }
  }, [services]);

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-white font-black uppercase tracking-[0.3em] text-sm animate-pulse">Cargando Menú...</p>
        </div>
      </div>
    );
  }

  if (!services || services.length === 0) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center text-white">
        <p className="font-black uppercase tracking-widest text-xl opacity-50">No hay productos activos en el menú.</p>
      </div>
    );
  }

  const currentService = services[currentIndex];

  return (
    <div className="h-screen w-full bg-black overflow-hidden relative font-sans">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentService.id}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute inset-0 w-full h-full"
        >
          <div className="absolute inset-0 w-full h-full">
            <img
              src={currentService.imageUrl || 'https://picsum.photos/seed/menu/1920/1080'}
              alt={currentService.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40" />
          </div>

          <div className="relative h-full w-full flex flex-col justify-center px-20 lg:px-32">
            <motion.div
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="max-w-[90%] space-y-8"
            >
              <div className="inline-block px-8 py-3 bg-primary text-white rounded-2xl font-black uppercase tracking-[0.4em] text-xl shadow-2xl border-2 border-white/20 backdrop-blur-xl">
                {CATEGORY_MAP[currentService.category] || currentService.category}
              </div>

              <h1 className="text-[7rem] font-black text-white uppercase tracking-tighter leading-[0.85] drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
                {currentService.name}
              </h1>

              <div className="flex items-center gap-10">
                <div className="bg-white/10 backdrop-blur-3xl border-2 border-white/20 rounded-[3rem] px-12 py-6 shadow-2xl">
                    <p className="text-primary font-black text-8xl tracking-tighter drop-shadow-lg">
                        {formatCurrency(currentService.price)}
                    </p>
                </div>
                
                {currentService.description && (
                    <p className="text-white/60 text-3xl font-medium max-w-2xl leading-relaxed italic border-l-4 border-primary pl-8">
                        "{currentService.description}"
                    </p>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute top-12 right-12 flex flex-col items-end gap-2 z-50">
        <div className="bg-black/40 backdrop-blur-xl px-8 py-4 rounded-3xl border border-white/10 flex items-center gap-4 shadow-2xl">
            <Clock className="h-10 w-10 text-primary animate-pulse" />
            <span className="text-white text-5xl font-black font-mono tracking-tighter">
                {now.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
        </div>
        <p className="text-white/40 font-black uppercase tracking-[0.3em] text-xs mr-2">Digital Menu Board</p>
      </div>

      <div className="absolute bottom-0 left-0 h-3 bg-white/10 w-full z-50 overflow-hidden">
        <motion.div 
          key={currentIndex}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 8, ease: "linear" }}
          className="h-full bg-primary shadow-[0_0_20px_rgba(var(--primary),0.8)]"
        />
      </div>
    </div>
  );
}