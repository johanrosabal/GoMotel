'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Service, CompanyProfile } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { ImageIcon, Clock, Utensils, Beer, Sparkles } from 'lucide-react';
import { doc } from 'firebase/firestore';
import { useDoc } from '@/firebase';

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [now, setNow] = useState(new Date());

  const servicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'services'), where('isActive', '==', true));
  }, [firestore]);

  const { data: services, isLoading } = useCollection<Service>(servicesQuery);
  
  const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companyInfo', 'main') : null, [firestore]);
  const { data: company } = useDoc<CompanyProfile>(companyRef);

  // Filtrar solo productos con imagen para el Menu Board de publicidad
  const promoItems = useMemo(() => {
    if (!services) return [];
    return services.filter(s => !!s.imageUrl);
  }, [services]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (promoItems.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % promoItems.length);
    }, 8000); // Rotación cada 8 segundos
    return () => clearInterval(interval);
  }, [promoItems.length]);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-20 w-20 bg-zinc-800 rounded-full" />
          <div className="h-4 w-48 bg-zinc-800 rounded" />
        </div>
      </div>
    );
  }

  if (promoItems.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-950 text-white p-10 text-center">
        <div className="max-w-md space-y-4">
            <Utensils className="h-20 w-20 mx-auto text-zinc-800" />
            <h1 className="text-2xl font-bold uppercase tracking-widest opacity-50">Menú no disponible</h1>
            <p className="text-zinc-500">Por favor, cargue productos con imágenes en el catálogo para activar el Menu Board.</p>
        </div>
      </div>
    );
  }

  const currentProduct = promoItems[currentIndex];

  const categoryLabels: Record<string, string> = {
    'Food': 'Nuestra Cocina',
    'Beverage': 'Refrescante',
    'Amenity': 'Confort'
  };

  return (
    <div className="h-screen w-full bg-black overflow-hidden relative">
      {/* Background Ken Burns Effect */}
      {promoItems.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            "absolute inset-0 transition-opacity duration-[2000ms] ease-in-out",
            index === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0"
          )}
        >
          <img
            src={item.imageUrl}
            alt={item.name}
            className={cn(
              "h-full w-full object-cover transition-transform duration-[10000ms] ease-linear",
              index === currentIndex ? "scale-110" : "scale-100"
            )}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
        </div>
      ))}

      {/* Top Bar: Logo & Time */}
      <div className="absolute top-0 inset-x-0 p-10 flex justify-between items-start z-30 pointer-events-none">
        <div className="flex items-center gap-6 bg-black/40 backdrop-blur-xl px-8 py-4 rounded-full border border-white/10 shadow-2xl">
          {company?.logoUrl && (
            <img src={company.logoUrl} alt="Logo" className="h-12 w-12 object-contain" />
          )}
          <span className="text-3xl font-black uppercase tracking-tighter text-white">
            {company?.tradeName || 'Go Motel'}
          </span>
        </div>

        <div className="flex flex-col items-end gap-2 bg-black/40 backdrop-blur-xl px-10 py-5 rounded-3xl border border-white/10 shadow-2xl">
          <p className="text-6xl font-black font-mono tracking-tighter text-primary">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-sm font-black text-zinc-400 uppercase tracking-[0.3em]">
            {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Main Content: McDonald's Style */}
      <div className="absolute bottom-0 inset-x-0 p-20 z-30 pointer-events-none">
        <div className="max-w-[90%] space-y-6 animate-in fade-in slide-in-from-left-10 duration-1000">
          <div className="flex items-center gap-4">
            <span className="px-6 py-2 bg-primary text-primary-foreground font-black text-sm uppercase tracking-[0.3em] rounded-full shadow-xl">
              RECOMENDADO: {categoryLabels[currentProduct.category] || 'Destacado'}
            </span>
            <div className="h-1 w-32 bg-white/20 rounded-full overflow-hidden">
                <div 
                    key={currentIndex}
                    className="h-full bg-primary animate-[progress_8s_linear_forwards]" 
                    style={{ animationDuration: '8000ms' }}
                />
            </div>
          </div>

          <h1 className="text-[7rem] font-black text-white uppercase tracking-tighter leading-[0.85] drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
            {currentProduct.name}
          </h1>

          <div className="flex items-baseline gap-6 mt-4">
            <span className="text-8xl font-black text-primary drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              {formatCurrency(currentProduct.price)}
            </span>
            {currentProduct.code && (
                <span className="text-2xl font-bold text-white/40 uppercase tracking-widest font-mono">
                    REF: {currentProduct.code}
                </span>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
