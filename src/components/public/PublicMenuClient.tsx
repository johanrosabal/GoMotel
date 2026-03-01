'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service, CompanyProfile } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [time, setTime] = useState(new Date());

  // Data Fetching
  const servicesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'services'), where('isActive', '==', true)) : null, 
    [firestore]
  );
  const { data: allServices, isLoading } = useCollection<Service>(servicesQuery);

  const activeServices = useMemo(() => {
    if (!allServices) return [];
    return allServices.filter(s => s.source === 'Internal' || s.stock > 0);
  }, [allServices]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeServices.length <= 1) return;
    const slideTimer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeServices.length);
    }, 8000);
    return () => clearInterval(slideTimer);
  }, [activeServices.length]);

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-white font-black uppercase tracking-[0.3em] animate-pulse">Cargando Menú...</p>
        </div>
      </div>
    );
  }

  if (activeServices.length === 0) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <p className="text-white font-black uppercase tracking-[0.3em]">Menú no disponible</p>
      </div>
    );
  }

  const currentProduct = activeServices[currentIndex];

  return (
    <div className="h-screen w-full bg-black overflow-hidden relative font-sans cursor-none">
      {/* Reloj y Marca */}
      <div className="absolute top-10 left-10 z-50 flex items-baseline gap-6 drop-shadow-2xl">
        <div className="bg-black/40 backdrop-blur-3xl px-8 py-4 rounded-[2rem] border-2 border-white/10 flex items-center gap-4">
          <Clock className="h-8 w-8 text-primary animate-pulse" />
          <span className="text-5xl font-black tracking-tighter text-white tabular-nums">
            {time.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentProduct.id}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute inset-0"
        >
          {/* Imagen de Fondo Gigante */}
          <div className="absolute inset-0">
            {currentProduct.imageUrl ? (
              <img 
                src={currentProduct.imageUrl} 
                alt={currentProduct.name}
                className="w-full h-full object-cover brightness-[0.7] scale-105"
              />
            ) : (
              <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
                <Utensils className="h-64 w-64 text-white/5" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
          </div>

          {/* Información del Producto */}
          <div className="absolute inset-0 flex flex-col justify-end p-20 pb-32">
            <motion.div
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="space-y-6 max-w-[80%]"
            >
              <Badge className="bg-primary text-white text-3xl font-black uppercase tracking-[0.2em] px-10 py-4 rounded-full border-0 shadow-2xl">
                {currentProduct.category}
              </Badge>
              
              <h1 
                className="text-white font-black tracking-tighter leading-[0.85] uppercase drop-shadow-2xl"
                style={{ fontSize: '7rem' }}
              >
                {currentProduct.name}
              </h1>

              <div className="flex items-center gap-10 pt-4">
                <div className="bg-white/10 backdrop-blur-3xl border-2 border-white/20 px-12 py-6 rounded-[3rem] shadow-2xl">
                  <span className="text-primary font-black tracking-tighter" style={{ fontSize: '6rem' }}>
                    {formatCurrency(currentProduct.price)}
                  </span>
                </div>
                
                {currentProduct.description && (
                  <p className="text-white/60 text-3xl font-medium max-w-2xl leading-relaxed italic">
                    "{currentProduct.description}"
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Indicadores de Progreso Inferiores */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 flex gap-3">
        {activeServices.map((_, i) => (
          <div 
            key={i}
            className={cn(
              "h-2 rounded-full transition-all duration-1000",
              currentIndex === i ? "w-16 bg-primary" : "w-2 bg-white/20"
            )}
          />
        ))}
      </div>
    </div>
  );
}

function Utensils(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  );
}
