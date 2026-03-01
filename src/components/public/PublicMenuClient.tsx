'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Service, CompanyProfile } from '@/types';
import { doc } from 'firebase/firestore';
import { useDoc } from '@/firebase';
import { formatCurrency, cn } from '@/lib/utils';
import { Clock, Star } from 'lucide-react';

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [now, setNow] = useState(new Date());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // 1. Fetch Company Info for Logo
  const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companyInfo', 'main') : null, [firestore]);
  const { data: company } = useDoc<CompanyProfile>(companyRef);

  // 2. Fetch Active Services
  const servicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'services'), where('isActive', '==', true));
  }, [firestore]);
  const { data: services, isLoading } = useCollection<Service>(servicesQuery);

  // 3. Filter only services with images for the TV board
  const featuredProducts = useMemo(() => {
    if (!services) return [];
    return services.filter(s => !!s.imageUrl);
  }, [services]);

  // 4. Clock and Progress Timer
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    
    const slideDuration = 8000; // 8 seconds per slide
    const interval = 100; // 100ms for smooth progress
    
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          setCurrentIndex(current => (current + 1) % (featuredProducts.length || 1));
          return 0;
        }
        return prev + (interval / slideDuration) * 100;
      });
    }, interval);

    return () => {
      clearInterval(timer);
      clearInterval(progressTimer);
    };
  }, [featuredProducts.length]);

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <div className="text-white flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="font-black uppercase tracking-[0.3em] text-xs">Cargando Menú Board...</p>
        </div>
      </div>
    );
  }

  const currentProduct = featuredProducts[currentIndex];

  return (
    <div className="h-screen w-full bg-black overflow-hidden relative font-sans text-white select-none">
      {/* 1. Progress Bar */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-white/10 z-50">
        <div 
          className="h-full bg-primary transition-all duration-100 ease-linear shadow-[0_0_15px_rgba(var(--primary),0.5)]" 
          style={{ width: `${progress}%` }} 
        />
      </div>

      {/* 2. Top Header (Logo & Clock) */}
      <div className="absolute top-6 left-10 right-10 flex justify-between items-start z-40 pointer-events-none">
        <div className="flex items-center gap-4 bg-black/40 backdrop-blur-xl p-4 rounded-3xl border border-white/10 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-700">
          {company?.logoUrl ? (
            <img src={company.logoUrl} alt="Logo" className="h-12 w-12 object-contain" />
          ) : (
            <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center font-black text-2xl">M</div>
          )}
          <div className="pr-4">
            <h1 className="font-black text-xl tracking-tighter uppercase leading-none">
              {company?.tradeName || 'Go Motel'}
            </h1>
            <p className="text-[10px] font-bold text-primary tracking-widest uppercase mt-1">Digital Menu Board</p>
          </div>
        </div>

        <div className="text-right bg-black/40 backdrop-blur-xl p-4 px-8 rounded-3xl border border-white/10 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-700">
          <p className="text-5xl font-black font-mono tracking-tighter text-primary">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">
            {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* 3. Main Slide Show */}
      {featuredProducts.length > 0 ? (
        <div className="relative h-full w-full">
          {featuredProducts.map((product, index) => (
            <div 
              key={product.id}
              className={cn(
                "absolute inset-0 transition-all duration-1000 ease-in-out",
                index === currentIndex ? "opacity-100 scale-100" : "opacity-0 scale-110 pointer-events-none"
              )}
            >
              {/* Background Image with Ken Burns Effect */}
              <div className="absolute inset-0 overflow-hidden">
                <img 
                  src={product.imageUrl} 
                  alt={product.name} 
                  className={cn(
                    "h-full w-full object-cover transition-transform duration-[8000ms] ease-linear",
                    index === currentIndex ? "scale-110" : "scale-100"
                  )}
                />
                {/* Dark Vignette Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
              </div>

              {/* Product Info (Bottom Left) */}
              <div className="absolute bottom-20 left-16 max-w-4xl z-30 animate-in fade-in slide-in-from-left-10 duration-1000 delay-300">
                <div className="flex items-center gap-2 mb-6">
                  <span className="bg-primary px-4 py-1.5 rounded-sm font-black text-xs uppercase tracking-[0.2em] shadow-lg">
                    Recomendado: {product.category === 'Beverage' ? 'Bebidas' : product.category === 'Food' ? 'Comidas' : 'Servicios'}
                  </span>
                  <div className="flex gap-1 text-primary">
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                  </div>
                </div>
                
                <h2 className="text-[140px] font-black uppercase tracking-tighter leading-[0.85] text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
                  {product.name}
                </h2>
                
                <div className="flex items-end gap-10 mt-8">
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-primary uppercase tracking-[0.3em] mb-1">Precio Especial</span>
                    <p className="text-8xl font-black tracking-tighter text-white drop-shadow-lg">
                      {formatCurrency(product.price)}
                    </p>
                  </div>
                  {product.code && (
                    <div className="mb-4 border-l-2 border-white/20 pl-10">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">Código de Pedido</span>
                      <span className="text-4xl font-mono font-black text-zinc-200">{product.code}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-full w-full flex items-center justify-center flex-col gap-6 bg-zinc-950">
          <div className="p-10 rounded-full bg-zinc-900 border border-white/5 animate-pulse">
            <Star className="h-20 w-20 text-zinc-800" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-black uppercase tracking-tighter text-zinc-500">No hay productos destacados</h2>
            <p className="text-zinc-600 font-bold uppercase text-xs tracking-widest">Añada imágenes a sus productos para verlos aquí</p>
          </div>
        </div>
      )}

      {/* 4. Footer Brand Bar */}
      <div className="absolute bottom-0 left-0 w-full p-6 px-10 flex justify-between items-center z-40 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
            Transmisión en Vivo • {company?.tradeName || 'Go Motel'}
          </p>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
          Pida desde su mesa escaneando el código QR
        </p>
      </div>
    </div>
  );
}
