'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { Service, CompanyProfile } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Clock, Star, Sparkles, Zap } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Props {
  initialServices: Service[];
}

export default function PublicMenuClient({ initialServices }: Props) {
  const { firestore } = useFirebase();
  const [now, setNow] = useState(new Date());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companyInfo', 'main') : null, [firestore]);
  const { data: company } = useDoc<CompanyProfile>(companyRef);

  const activeServices = useMemo(() => initialServices.filter(s => s.isActive), [initialServices]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // McDonald's style auto-cycle
  useEffect(() => {
    if (activeServices.length <= 1) return;

    const cycleTimer = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % activeServices.length);
        setIsTransitioning(false);
      }, 800); // Cross-fade duration
    }, 8000); // Slide duration

    return () => clearInterval(cycleTimer);
  }, [activeServices.length]);

  const currentProduct = activeServices[currentIndex];

  if (!currentProduct) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <p className="text-white font-black uppercase tracking-widest animate-pulse">Actualizando Menú...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-black overflow-hidden relative cursor-none select-none">
      {/* Background Image with Ken Burns Effect */}
      <div className="absolute inset-0 z-0">
        <div className={cn(
          "relative h-full w-full transition-all duration-[8000ms] ease-linear",
          !isTransitioning ? "scale-110" : "scale-100"
        )}>
          <img 
            src={currentProduct.imageUrl || 'https://picsum.photos/seed/menu/1920/1080'} 
            alt={currentProduct.name}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-1000",
              isTransitioning ? "opacity-0" : "opacity-100"
            )}
          />
          {/* Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
        </div>
      </div>

      {/* Top Bar: Logo & Clock */}
      <div className="absolute top-0 inset-x-0 z-20 p-10 flex justify-between items-start">
        <div className="flex items-center gap-6 animate-in slide-in-from-top-4 duration-1000">
          {company?.logoUrl ? (
            <img src={company.logoUrl} className="h-20 w-20 object-contain drop-shadow-2xl" alt="Logo" />
          ) : (
            <div className="h-20 w-20 bg-primary rounded-3xl flex items-center justify-center text-primary-foreground font-black text-4xl shadow-2xl">
              {company?.tradeName?.[0] || 'G'}
            </div>
          )}
          <div className="space-y-1">
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase drop-shadow-lg">
              {company?.tradeName || 'Go Motel'}
            </h2>
            <div className="flex items-center gap-3">
              <Badge className="bg-primary/90 text-primary-foreground border-0 font-black uppercase tracking-widest px-3">Abierto 24/7</Badge>
              <span className="text-white/60 font-bold uppercase text-sm flex items-center gap-2"><Sparkles className="h-4 w-4" /> Servicio a la habitación</span>
            </div>
          </div>
        </div>

        <div className="text-right bg-black/40 backdrop-blur-xl px-10 py-6 rounded-[2.5rem] border border-white/10 shadow-2xl animate-in slide-in-from-right-4 duration-1000">
          <p className="text-7xl font-black font-mono tracking-tighter text-primary leading-none">
            {now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-sm font-black text-zinc-400 uppercase tracking-[0.3em] mt-2">
            {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Main Product Info: McDonald's Style */}
      <div className="absolute bottom-0 inset-x-0 z-20 p-20 flex flex-col items-start gap-6 pointer-events-none">
        
        {/* Category Tag */}
        <div className={cn(
          "bg-white text-black px-6 py-2 rounded-full flex items-center gap-3 shadow-2xl transition-all duration-1000",
          isTransitioning ? "opacity-0 -translate-x-10" : "opacity-100 translate-x-0"
        )}>
          <Zap className="h-5 w-5 fill-current text-primary" />
          <span className="font-black text-sm uppercase tracking-[0.2em]">RECOMENDADO: {currentProduct.category === 'Food' ? 'DELICIAS DE COCINA' : 'BEBIDAS HELADAS'}</span>
        </div>

        {/* Product Name */}
        <div className={cn(
          "max-w-[90%] transition-all duration-700 delay-100",
          isTransitioning ? "opacity-0 translate-y-10" : "opacity-100 translate-y-0"
        )}>
          <h1 className="text-[7rem] font-black text-white uppercase tracking-tighter leading-[0.85] drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
            {currentProduct.name}
          </h1>
        </div>

        {/* Price Tag */}
        <div className={cn(
          "mt-4 flex items-center gap-8 transition-all duration-700 delay-200",
          isTransitioning ? "opacity-0 translate-y-10" : "opacity-100 translate-y-0"
        )}>
          <div className="bg-primary px-10 py-4 rounded-[2rem] shadow-[0_20px_50px_rgba(var(--primary),0.3)] flex items-center gap-4">
            <span className="text-[10px] font-black text-primary-foreground/60 uppercase tracking-[0.3em] [writing-mode:vertical-lr] rotate-180">PRECIO</span>
            <span className="text-7xl font-black text-primary-foreground tracking-tighter">
              {formatCurrency(currentProduct.price)}
            </span>
          </div>
          
          {currentProduct.description && (
            <p className="max-w-md text-xl font-bold text-white/80 leading-snug drop-shadow-md">
              {currentProduct.description}
            </p>
          )}
        </div>
      </div>

      {/* Progress Bar (McDonald's Style) */}
      <div className="absolute top-0 inset-x-0 h-2 z-30 overflow-hidden">
        <div 
          key={currentIndex} 
          className="h-full bg-primary/80 animate-progress-grow origin-left" 
          style={{ animationDuration: '8000ms' }} 
        />
      </div>

      {/* Side Counter */}
      <div className="absolute bottom-10 right-10 z-20 flex items-center gap-4">
        <span className="text-white/20 font-black text-8xl tracking-tighter">{String(currentIndex + 1).padStart(2, '0')}</span>
        <div className="h-1 w-20 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500" 
            style={{ width: `${((currentIndex + 1) / activeServices.length) * 100}%` }} 
          />
        </div>
        <span className="text-white/40 font-black text-xl">{String(activeServices.length).padStart(2, '0')}</span>
      </div>

      <style jsx global>{`
        @keyframes progress-grow {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        .animate-progress-grow {
          animation-name: progress-grow;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}
