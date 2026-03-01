'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Service } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock } from 'lucide-react';

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [activeIndex, setActiveItemIndex] = useState(0);
  const [now, setNow] = useState(new Date());

  const servicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'services'), where('isActive', '==', true));
  }, [firestore]);

  const { data: services, isLoading } = useCollection<Service>(servicesQuery);

  // Filter out internal services if they don't have images or aren't meant for display
  const menuItems = useMemo(() => {
    return services?.filter(s => s.imageUrl) || [];
  }, [services]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (menuItems.length <= 1) return;
    const cycle = setInterval(() => {
      setActiveItemIndex((prev) => (prev + 1) % menuItems.length);
    }, 8000); // Cambia cada 8 segundos
    return () => clearInterval(cycle);
  }, [menuItems.length]);

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <Skeleton className="h-full w-full opacity-20" />
      </div>
    );
  }

  if (menuItems.length === 0) {
    return (
      <div className="h-screen w-full bg-zinc-950 flex flex-col items-center justify-center text-center p-10">
        <h1 className="text-4xl font-black text-white uppercase tracking-tighter mb-4">Menú No Disponible</h1>
        <p className="text-zinc-500 text-xl max-w-lg">Actualmente no hay productos con imagen para mostrar en la cartelera digital.</p>
      </div>
    );
  }

  const activeItem = menuItems[activeIndex];

  return (
    <div className="h-screen w-full bg-black overflow-hidden relative font-sans">
      {/* Background Image with Ken Burns Effect */}
      <div className="absolute inset-0 z-0">
        {menuItems.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              "absolute inset-0 transition-all duration-[2000ms] ease-in-out",
              index === activeIndex ? "opacity-100 scale-110" : "opacity-0 scale-100"
            )}
          >
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover"
            />
            {/* Massive Gradients for legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
          </div>
        ))}
      </div>

      {/* Top Header Overlay */}
      <div className="absolute top-0 left-0 w-full z-30 p-12 flex justify-between items-start pointer-events-none">
        <div className="bg-primary/90 text-primary-foreground px-8 py-4 rounded-full shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-10 duration-700">
          <span className="text-2xl font-black uppercase tracking-widest">Digital Menu Board</span>
        </div>
        
        <div className="text-right bg-black/40 px-10 py-6 rounded-[2.5rem] border border-white/10 backdrop-blur-xl shadow-2xl">
          <p className="text-7xl font-black font-mono tracking-tighter text-white tabular-nums leading-none">
            {now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-sm font-black text-primary uppercase tracking-[0.3em] mt-3">
            {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Main Product Info Overlay */}
      <div className="absolute inset-0 z-20 flex flex-col justify-end p-20 pb-32">
        <div className="space-y-8 max-w-[90%] animate-in fade-in slide-in-from-left-10 duration-1000">
          <div className="flex items-center gap-4">
            <span className="bg-white text-black px-6 py-2 rounded-full font-black text-xl uppercase tracking-tighter shadow-xl">
              RECOMENDADO
            </span>
            <div className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                <div 
                    key={activeIndex}
                    className="h-full bg-primary transition-all duration-[8000ms] ease-linear"
                    style={{ width: '100%' }}
                />
            </div>
          </div>

          <h1 className="text-[10rem] font-black text-white uppercase tracking-tighter leading-[0.8] drop-shadow-[0_15px_40px_rgba(0,0,0,0.9)]">
            {activeItem.name}
          </h1>

          <div className="flex items-end gap-10">
            <div className="bg-primary px-12 py-6 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-4 border-white/20 transform -rotate-2">
                <p className="text-[6rem] font-black text-white leading-none tracking-tighter">
                    {formatCurrency(activeItem.price)}
                </p>
            </div>
            <div className="pb-4 space-y-1">
                <p className="text-2xl font-black text-zinc-400 uppercase tracking-widest">Referencia</p>
                <p className="text-4xl font-black text-white/80 font-mono">{activeItem.code || 'P-000'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Visual Decoration */}
      <div className="absolute bottom-0 left-0 w-full h-2 bg-white/5 z-30">
        <div 
            key={`progress-${activeIndex}`}
            className="h-full bg-primary shadow-[0_0_20px_rgba(var(--primary),0.8)]"
            style={{ 
                animation: 'progress-bar 8s linear forwards'
            }} 
        />
      </div>

      <style jsx global>{`
        @keyframes progress-bar {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
