
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service, CompanyProfile } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [now, setNow] = useState(new Date());

  // Data Fetching
  const servicesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'services'), where('isActive', '==', true)) : null, 
    [firestore]
  );
  const { data: services } = useCollection<Service>(servicesQuery);

  const companyRef = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'companyInfo')) : null, 
    [firestore]
  );
  const { data: companyData } = useCollection<CompanyProfile>(companyRef);
  const company = companyData?.[0];

  // Clock Update
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Slideshow logic
  const activeProducts = useMemo(() => {
    if (!services) return [];
    return services.filter(s => s.imageUrl);
  }, [services]);

  useEffect(() => {
    if (activeProducts.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeProducts.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [activeProducts.length]);

  if (!services || activeProducts.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="font-black uppercase tracking-[0.3em] text-xs opacity-50">Cargando Menú Publicitario...</p>
        </div>
      </div>
    );
  }

  const currentProduct = activeProducts[currentIndex];

  return (
    <div className="h-screen w-full bg-black overflow-hidden relative font-sans">
      {/* ProgressBar */}
      <div className="absolute top-0 left-0 w-full h-1.5 z-50 bg-white/10">
        <motion.div 
          key={currentIndex}
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 8, ease: "linear" }}
          className="h-full bg-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]"
        />
      </div>

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
          <motion.img
            src={currentProduct.imageUrl}
            alt={currentProduct.name}
            initial={{ scale: 1 }}
            animate={{ scale: 1.1 }}
            transition={{ duration: 10, ease: "linear" }}
            className="w-full h-full object-cover"
          />
          
          {/* Overlay Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />

          {/* Product Info - McDonald's Style */}
          <div className="absolute bottom-0 left-0 w-full p-16 lg:p-24 z-20 flex flex-col items-start gap-6">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="flex flex-col gap-2"
            >
              <span className="bg-primary text-primary-foreground px-6 py-2 rounded-full text-xl font-black uppercase tracking-[0.2em] shadow-2xl">
                RECOMENDADO: {currentProduct.category === 'Food' ? 'COMIDA' : currentProduct.category === 'Beverage' ? 'BEBIDA' : 'AMENIDAD'}
              </span>
              
              <div className="max-w-[90%] mt-4">
                <h1 className="text-[7rem] lg:text-[9rem] font-black text-white uppercase tracking-tighter leading-[0.85] drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
                  {currentProduct.name}
                </h1>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1, duration: 0.5 }}
              className="mt-4 flex items-baseline gap-4"
            >
              <span className="text-primary text-6xl lg:text-8xl font-black tabular-nums drop-shadow-2xl">
                {formatCurrency(currentProduct.price)}
              </span>
              <span className="text-white/40 text-2xl lg:text-3xl font-bold uppercase tracking-widest">I.V.A Incluido</span>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Header UI: Clock and Logo */}
      <div className="absolute top-12 left-16 right-16 z-40 flex justify-between items-start pointer-events-none">
        <div className="flex items-center gap-6 bg-black/40 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-[2rem] shadow-2xl">
          {company?.logoUrl && <img src={company.logoUrl} alt="Logo" className="h-12 w-12 object-contain" />}
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter text-white">{company?.tradeName || 'Go Motel'}</h2>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Premium Digital Menu</p>
          </div>
        </div>

        <div className="text-right bg-black/40 backdrop-blur-xl border border-white/10 px-10 py-4 rounded-[2rem] shadow-2xl">
          <p className="text-5xl font-black font-mono tracking-tighter text-primary">
            {now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-xs font-black text-white/60 uppercase tracking-widest mt-1">
            {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Slide Indicators */}
      <div className="absolute bottom-12 right-16 z-40 flex gap-3">
        {activeProducts.map((_, idx) => (
          <div 
            key={idx}
            className={cn(
              "h-2 rounded-full transition-all duration-500 shadow-lg",
              idx === currentIndex ? "w-12 bg-primary" : "w-2 bg-white/20"
            )}
          />
        ))}
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
