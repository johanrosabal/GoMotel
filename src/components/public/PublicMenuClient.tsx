
'use client';

import { useState, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Service } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Clock } from 'lucide-react';

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [now, setNow] = useState(new Date());

  const servicesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'services'), where('isActive', '==', true)) : null, 
    [firestore]
  );
  const { data: services, isLoading } = useCollection<Service>(servicesQuery);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!services || services.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % services.length);
    }, 8000); // Rotar cada 8 segundos
    return () => clearInterval(interval);
  }, [services]);

  if (isLoading || !services || services.length === 0) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-20 w-20 bg-muted rounded-full" />
          <div className="h-4 w-48 bg-muted rounded" />
        </div>
      </div>
    );
  }

  const currentService = services[currentIndex];

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative">
      {/* Background Image with Zoom Effect */}
      <div className="absolute inset-0 transition-all duration-[8000ms] ease-linear scale-110">
        {currentService.imageUrl ? (
          <img 
            src={currentService.imageUrl} 
            alt={currentService.name} 
            className="w-full h-full object-cover opacity-60"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-background" />
        )}
      </div>

      {/* Overlay Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-20 bg-gradient-to-t from-black via-transparent to-transparent">
        <div className="space-y-6 max-w-6xl animate-in slide-in-from-left-10 duration-1000">
          <div className="flex items-center gap-4">
            <span className="px-6 py-2 rounded-full bg-primary text-primary-foreground font-black uppercase text-xl tracking-[0.3em]">
              {currentService.category === 'Food' ? 'Comida' : 'Bebida'}
            </span>
            <div className="h-1 flex-1 bg-white/20 rounded-full" />
          </div>
          
          <h1 className="text-[10rem] font-black uppercase tracking-tighter leading-[0.85] text-white drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            {currentService.name}
          </h1>
          
          <div className="flex items-baseline gap-10">
            <p className="text-[8rem] font-black text-primary tracking-tighter drop-shadow-2xl">
              {formatCurrency(currentService.price)}
            </p>
            {currentService.description && (
              <p className="text-3xl text-white/60 font-medium max-w-2xl leading-relaxed italic">
                "{currentService.description}"
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Header Info */}
      <div className="absolute top-0 left-0 w-full p-12 flex justify-between items-start pointer-events-none">
        <div className="bg-black/40 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/10 flex items-center gap-6 shadow-2xl">
          <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center">
            <Clock className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="pr-4">
            <p className="text-5xl font-black text-white tabular-nums tracking-tighter">
              {now.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-xs font-black uppercase tracking-[0.4em] text-primary mt-1">Servicio Disponible</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
            <div className="bg-white text-black px-8 py-4 rounded-full font-black text-2xl uppercase tracking-widest shadow-2xl">
                Menú Digital
            </div>
            <div className="text-white/40 font-black text-sm uppercase tracking-[0.5em] pr-4">
                Publicidad Real-Time
            </div>
        </div>
      </div>

      {/* Progress Bars (Indicators) */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-3">
        {services.map((_, idx) => (
          <div 
            key={idx} 
            className={cn(
              "h-2 rounded-full transition-all duration-500",
              idx === currentIndex ? "w-16 bg-primary shadow-[0_0_20px_rgba(var(--primary),0.5)]" : "w-2 bg-white/20"
            )} 
          />
        ))}
      </div>
    </div>
  );
}
