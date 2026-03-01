'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Service, CompanyProfile } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import AppLogo from '@/components/AppLogo';

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [now, setNow] = useState(new Date());
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-slide effect
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const servicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'services'), orderBy('name'));
  }, [firestore]);

  const { data: services, isLoading } = useCollection<Service>(servicesQuery);
  const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companyInfo', 'main') : null, [firestore]);
  const { data: company } = useDoc<CompanyProfile>(companyRef);

  const activeServices = useMemo(() => services?.filter(s => s.isActive) || [], [services]);

  useEffect(() => {
    if (activeServices.length > 0) {
      const interval = setInterval(() => {
        setActiveIndex((prev) => (prev + 1) % activeServices.length);
      }, 8000); // Rotate every 8 seconds
      return () => clearInterval(interval);
    }
  }, [activeServices]);

  if (isLoading) {
    return <div className="h-screen w-full bg-black flex items-center justify-center"><Skeleton className="h-20 w-64 bg-zinc-800" /></div>;
  }

  if (activeServices.length === 0) {
    return <div className="h-screen w-full bg-black flex items-center justify-center text-white font-black uppercase tracking-widest">No hay productos activos</div>;
  }

  const currentProduct = activeServices[activeIndex];

  return (
    <div className="h-screen w-full bg-black overflow-hidden relative cursor-none select-none">
      {/* Background Images Layer */}
      {activeServices.map((service, index) => (
        <div 
          key={service.id}
          className={cn(
            "absolute inset-0 transition-all duration-1000 ease-in-out",
            index === activeIndex ? "opacity-100 scale-100 z-10" : "opacity-0 scale-110 z-0"
          )}
        >
          <img 
            src={service.imageUrl || 'https://picsum.photos/seed/menu/1920/1080'} 
            alt={service.name} 
            className="w-full h-full object-cover brightness-[0.6]"
          />
        </div>
      ))}

      {/* Progress Bar Top */}
      <div className="fixed top-0 left-0 right-0 h-1 z-50">
        <div 
          key={activeIndex}
          className="h-full bg-primary shadow-[0_0_15px_rgba(var(--primary),0.8)] animate-progress-fast"
          style={{ animationDuration: '8s' }}
        />
      </div>

      {/* Overlay Content */}
      <div className="absolute inset-0 z-20 flex flex-col justify-between p-12 lg:p-20">
        {/* Top Branding & Clock */}
        <div className="flex justify-between items-start animate-in fade-in slide-in-from-top-10 duration-700">
          <div className="flex items-center gap-6 bg-black/40 backdrop-blur-xl px-8 py-4 rounded-full border border-white/10 shadow-2xl">
            {company?.logoUrl ? (
              <img src={company.logoUrl} className="h-12 w-12 object-contain" alt="Logo" />
            ) : <AppLogo className="h-12 w-12 text-primary" />}
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-white">{company?.tradeName || 'Go Motel'}</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Menú Board</p>
            </div>
          </div>

          <div className="text-right bg-white/5 px-8 py-4 rounded-3xl border border-white/10 backdrop-blur-md">
            <p className="text-5xl font-black font-mono tracking-tighter text-primary">
              {now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mt-1">
              {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        {/* Product Information */}
        <div key={`info-${currentProduct.id}`} className="space-y-6 animate-in fade-in zoom-in-95 duration-1000 max-w-[90%]">
          <div className="space-y-2">
            <Badge className="bg-primary text-white text-xl px-6 py-2 rounded-full font-black uppercase tracking-widest border-none shadow-2xl">
              RECOMENDADO: {currentProduct.category === 'Beverage' ? 'BEBIDAS' : currentProduct.category === 'Food' ? 'COMIDAS' : 'AMENIDADES'}
            </Badge>
            <h1 className="text-[7rem] font-black text-white uppercase tracking-tighter leading-[0.85] drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
              {currentProduct.name}
            </h1>
          </div>
          
          <div className="flex items-center gap-10">
            <div className="bg-white px-10 py-6 rounded-[2.5rem] shadow-2xl transform -rotate-2">
              <p className="text-6xl font-black text-black tracking-tighter">
                {formatCurrency(currentProduct.price)}
              </p>
            </div>
            {currentProduct.description && (
              <p className="text-2xl font-bold text-white/80 max-w-2xl drop-shadow-lg leading-tight uppercase tracking-tight">
                {currentProduct.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes progress-fast {
          from { width: 0%; }
          to { width: 100%; }
        }
        .animate-progress-fast {
          animation-name: progress-fast;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}
