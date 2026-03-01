'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { Service, CompanyProfile } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { doc } from 'firebase/firestore';

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [now, setNow] = useState(new Date());

  const servicesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'services')) : null, [firestore]);
  const { data: services } = useCollection<Service>(servicesQuery);

  const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companyInfo', 'main') : null, [firestore]);
  const { data: company } = useDoc<CompanyProfile>(companyRef);

  const activeServices = useMemo(() => {
    return (services || []).filter(s => s.isActive);
  }, [services]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeServices.length > 0) {
      const cycle = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % activeServices.length);
      }, 8000); // 8 segundos por producto
      return () => clearInterval(cycle);
    }
  }, [activeServices.length]);

  if (!activeServices.length) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black">
        <p className="text-zinc-500 font-black uppercase tracking-widest animate-pulse">Cargando Menú Board...</p>
      </div>
    );
  }

  const currentProduct = activeServices[currentIndex];

  const categoryLabels: Record<string, string> = {
    'Food': 'COMIDAS',
    'Beverage': 'BEBIDAS',
    'Amenity': 'SERVICIOS'
  };

  return (
    <div className="h-screen w-full bg-black overflow-hidden relative font-sans text-white">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentProduct.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5 }}
          className="absolute inset-0"
        >
          {/* Background Image with Ken Burns Effect */}
          <motion.div 
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 8, ease: "linear" }}
            className="absolute inset-0"
          >
            {currentProduct.imageUrl ? (
              <img 
                src={currentProduct.imageUrl} 
                alt={currentProduct.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                <span className="text-zinc-800 text-[20rem] font-black">{currentProduct.name[0]}</span>
              </div>
            )}
            {/* Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
          </motion.div>

          {/* Product Content */}
          <div className="absolute inset-0 flex flex-col justify-end p-20 pb-32">
            <div className="max-w-[90%] space-y-2">
              <motion.div
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="bg-primary text-primary-foreground px-6 py-2 rounded-full w-fit font-black text-2xl tracking-[0.2em] mb-6 shadow-2xl"
              >
                RECOMENDADO: {categoryLabels[currentProduct.category] || 'ESPECIAL'}
              </motion.div>
              
              <motion.h1 
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.8 }}
                className="text-[7rem] font-black text-white uppercase tracking-tighter leading-[0.85] drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]"
              >
                {currentProduct.name}
              </motion.h1>

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1, duration: 0.5 }}
                className="mt-10 flex items-center gap-8"
              >
                <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[3rem] px-12 py-6 shadow-2xl">
                  <p className="text-[6rem] font-black text-white leading-none tracking-tighter">
                    {formatCurrency(currentProduct.price)}
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Persistent UI Elements */}
      <div className="absolute top-0 left-0 right-0 p-12 flex justify-between items-start z-50">
        {/* Logo and Brand */}
        <div className="flex items-center gap-6 bg-black/40 backdrop-blur-xl px-8 py-4 rounded-[2rem] border border-white/10">
          {company?.logoUrl && <img src={company.logoUrl} className="h-12 w-12 object-contain" alt="Logo" />}
          <span className="text-3xl font-black uppercase tracking-tighter">{company?.tradeName || 'GO MOTEL'}</span>
        </div>

        {/* Clock */}
        <div className="text-right bg-black/40 backdrop-blur-xl px-10 py-4 rounded-[2rem] border border-white/10">
          <p className="text-5xl font-black font-mono tracking-tighter text-primary">
            {now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mt-1">
            {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-white/5 z-50">
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

function useDoc<T>(ref: any) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!ref) return;
    const { onSnapshot } = require('firebase/firestore');
    return onSnapshot(ref, (snap: any) => {
      if (snap.exists()) setData({ id: snap.id, ...snap.data() } as T);
      setIsLoading(false);
    });
  }, [ref]);

  return { data, isLoading };
}
