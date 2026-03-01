'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Service, CompanyProfile } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { doc } from 'firebase/firestore';
import { useDoc } from '@/firebase';

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [now, setNow] = useState(new Date());
  const [currentIndex, setCurrentIndex] = useState(0);

  // Sync clock
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const servicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'services'), where('isActive', '==', true));
  }, [firestore]);

  const { data: services, isLoading } = useCollection<Service>(servicesQuery);

  const companyRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'companyInfo', 'main');
  }, [firestore]);
  const { data: company } = useDoc<CompanyProfile>(companyRef);

  const activeServices = useMemo(() => {
    if (!services) return [];
    return services.sort((a, b) => a.name.localeCompare(b.name));
  }, [services]);

  // Automatic cycle for Menu Board (Slideshow)
  useEffect(() => {
    if (activeServices.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeServices.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [activeServices.length]);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black">
        <Skeleton className="h-full w-full opacity-20" />
      </div>
    );
  }

  if (activeServices.length === 0) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-white p-10 text-center">
        <h1 className="text-4xl font-bold opacity-50">EL MENÚ ESTÁ ACTUALMENTE VACÍO</h1>
        <p className="mt-4 text-zinc-500">Estamos preparando nuevas sorpresas para usted.</p>
      </div>
    );
  }

  const currentProduct = activeServices[currentIndex];

  return (
    <div className="h-screen w-full bg-black overflow-hidden relative font-sans">
      {/* Background Image / Slide */}
      <div className="absolute inset-0 z-0">
        <div 
          key={currentProduct.id} 
          className="w-full h-full animate-in fade-in zoom-in-105 duration-[2000ms] ease-out"
        >
          {currentProduct.imageUrl ? (
            <img 
              src={currentProduct.imageUrl} 
              alt={currentProduct.name} 
              className="w-full h-full object-cover brightness-[0.6]" 
            />
          ) : (
            <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
              <span className="text-9xl opacity-10 font-black">NO IMAGE</span>
            </div>
          )}
        </div>
      </div>

      {/* Top Header Overlay */}
      <div className="absolute top-0 inset-x-0 p-8 flex justify-between items-start z-20">
        <div className="flex items-center gap-4 bg-black/40 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10 shadow-2xl">
          {company?.logoUrl && <img src={company.logoUrl} alt="Logo" className="h-8 w-8 object-contain" />}
          <span className="text-xl font-black text-white tracking-tighter uppercase">{company?.tradeName || 'GO MOTEL'}</span>
        </div>

        <div className="flex flex-col items-end gap-2 bg-black/40 backdrop-blur-xl px-8 py-4 rounded-3xl border border-white/10 shadow-2xl">
          <p className="text-5xl font-black font-mono tracking-tighter text-primary leading-none">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] pl-1">
            {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Main Info Overlay (McDonald's Style) */}
      <div className="absolute inset-x-0 bottom-0 p-12 lg:p-20 z-20 flex items-end justify-between bg-gradient-to-t from-black via-black/40 to-transparent">
        <div className="space-y-4 max-w-[90%] animate-in slide-in-from-left-10 duration-1000">
          <Badge className="bg-primary/20 text-primary border-primary/30 text-xl font-black uppercase tracking-[0.2em] px-6 py-2 backdrop-blur-md rounded-xl">
            RECOMENDADO: {currentProduct.category === 'Food' ? 'COMIDA' : currentProduct.category === 'Beverage' ? 'BEBIDA' : 'AMENIDAD'}
          </Badge>
          <h1 className="text-[7rem] font-black text-white uppercase tracking-tighter leading-[0.85] drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
            {currentProduct.name}
          </h1>
          {currentProduct.description && (
            <p className="text-3xl text-zinc-300 font-medium max-w-4xl leading-relaxed drop-shadow-md">
              {currentProduct.description}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-4 animate-in slide-in-from-right-10 duration-1000">
          <div className="bg-primary px-10 py-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(var(--primary),0.3)] ring-4 ring-white/10">
            <span className="text-[5rem] font-black text-white tracking-tighter leading-none">
              {formatCurrency(currentProduct.price)}
            </span>
          </div>
          <div className="flex gap-2">
            <div className="h-2 w-20 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full bg-primary animate-progress-line" style={{ animationDuration: '8000ms' }} />
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes progress-line {
          from { width: 0%; }
          to { width: 100%; }
        }
        .animate-progress-line {
          animation-name: progress-line;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}
