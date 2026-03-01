'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Service, CompanyProfile } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [now, setNow] = useState(new Date());

  const servicesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'services'), where('isActive', '==', true)) : null, 
    [firestore]
  );
  const { data: services } = useCollection<Service>(servicesQuery);

  const companyRef = useMemoFirebase(() => 
    firestore ? doc(firestore, 'companyInfo', 'main') : null, 
    [firestore]
  );
  const { data: company } = useDoc<CompanyProfile>(companyRef);

  // Filtrar solo productos con imagen para el Menu Board publicitario
  const featuredServices = useMemo(() => {
    if (!services) return [];
    return services.filter(s => !!s.imageUrl);
  }, [services]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (featuredServices.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredServices.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [featuredServices.length]);

  if (!featuredServices || featuredServices.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black text-white">
        <p className="text-xl font-bold animate-pulse">Cargando Menú Board...</p>
      </div>
    );
  }

  const currentProduct = featuredServices[currentIndex];

  const categoryLabels: Record<string, string> = {
    'Beverage': 'BEBIDA FRÍA',
    'Food': 'COMIDA CALIENTE',
    'Amenity': 'CUIDADO PERSONAL'
  };

  return (
    <div className="h-screen w-full bg-black overflow-hidden relative cursor-none">
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-50 p-10 flex justify-between items-start pointer-events-none">
        <div className="flex items-center gap-6">
          {company?.logoUrl && (
            <img src={company.logoUrl} alt="Logo" className="h-20 w-20 object-contain drop-shadow-lg" />
          )}
          <div className="space-y-1">
            <h2 className="text-white font-black text-4xl tracking-tighter uppercase drop-shadow-md">
              {company?.tradeName || 'Go Motel'}
            </h2>
            <div className="bg-primary px-3 py-1 rounded-full inline-block">
              <p className="text-[10px] font-black text-white tracking-[0.3em] uppercase">Digital Menu Board</p>
            </div>
          </div>
        </div>
        
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-[2rem] flex items-center gap-4 shadow-2xl">
          <Clock className="h-8 w-8 text-primary" />
          <span className="text-5xl font-black text-white tracking-tighter tabular-nums">
            {now.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 z-[60] h-1.5 bg-white/5">
        <motion.div 
          key={currentIndex}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
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
          transition={{ duration: 1 }}
          className="absolute inset-0"
        >
          {/* Background Image with Ken Burns effect */}
          <motion.div
            initial={{ scale: 1 }}
            animate={{ scale: 1.1 }}
            transition={{ duration: 8, ease: "linear" }}
            className="absolute inset-0"
          >
            <img 
              src={currentProduct.imageUrl} 
              alt={currentProduct.name} 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40" />
          </motion.div>

          {/* Product Info */}
          <div className="absolute inset-0 flex flex-col justify-end p-20 pb-24 z-10 max-w-[90%]">
            <motion.div
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4">
                <span className="bg-primary text-white text-xl font-black px-6 py-2 rounded-full tracking-[0.2em] uppercase">
                  {categoryLabels[currentProduct.category] || 'RECOMENDADO'}
                </span>
                {currentProduct.stock > 0 && currentProduct.stock <= 5 && (
                  <span className="bg-destructive text-white text-xl font-black px-6 py-2 rounded-full tracking-[0.2em] uppercase animate-pulse">
                    ¡Últimas Unidades!
                  </span>
                )}
              </div>

              <h1 className="text-[7rem] font-black text-white uppercase tracking-tighter leading-[0.85] drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
                {currentProduct.name}
              </h1>

              <div className="flex items-center gap-8">
                <div className="bg-white/10 backdrop-blur-2xl border border-white/20 p-8 rounded-[3rem] shadow-2xl">
                  <p className="text-primary font-black text-8xl tracking-tighter drop-shadow-2xl">
                    {formatCurrency(currentProduct.price)}
                  </p>
                </div>
                <p className="text-white/60 text-2xl font-medium max-w-xl leading-tight">
                  {currentProduct.description || 'Pídelo ahora desde la comodidad de tu habitación usando el código QR.'}
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Footer Branding */}
      <div className="absolute bottom-10 right-10 z-50 flex flex-col items-end opacity-40">
        <p className="text-white font-black text-lg tracking-[0.5em] uppercase">Digital Menu Board System</p>
        <p className="text-white/50 text-xs font-bold uppercase tracking-widest mt-1">Real-time advertising v2.5</p>
      </div>
    </div>
  );
}