'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { Service, CompanyProfile } from '@/types';
import { useDoc } from '@/firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [now, setNow] = useState(new Date());

  const servicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'services'), orderBy('name'));
  }, [firestore]);

  const { data: services, isLoading } = useCollection<Service>(servicesQuery);
  const activeServices = useMemo(() => services?.filter(s => s.isActive) || [], [services]);

  const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companyInfo', 'main') : null, [firestore]);
  const { data: company } = useDoc<CompanyProfile>(companyRef);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeServices.length > 0) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % activeServices.length);
      }, 8000); // 8 segundos por producto para captar la atención
      return () => clearInterval(interval);
    }
  }, [activeServices.length]);

  if (isLoading) return <div className="h-screen w-full flex items-center justify-center bg-black text-white text-3xl font-black uppercase tracking-widest animate-pulse">Cargando Menú...</div>;
  if (activeServices.length === 0) return <div className="h-screen w-full flex items-center justify-center bg-black text-white text-2xl font-bold">Menú temporalmente fuera de servicio.</div>;

  const currentService = activeServices[currentIndex];

  return (
    <div className="h-screen w-full overflow-hidden bg-black relative font-sans select-none">
      {/* Background Image: Pantalla Completa con Efecto Ken Burns */}
      <div key={currentService.id} className="absolute inset-0 transition-opacity duration-1000">
        <img 
          src={currentService.imageUrl || `https://picsum.photos/seed/${currentService.id}/1920/1080`} 
          alt={currentService.name}
          className="w-full h-full object-cover scale-110 animate-ken-burns"
        />
        {/* Degradados de Legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
      </div>

      {/* Header Board: Logo & Reloj Dinámico */}
      <div className="absolute top-0 left-0 w-full p-10 flex justify-between items-start z-30">
        <div className="flex items-center gap-6 bg-black/40 backdrop-blur-2xl p-5 px-8 rounded-[2rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-top-10 duration-1000">
          {company?.logoUrl ? (
              <img src={company.logoUrl} className="h-16 w-16 object-contain" alt="Logo" />
          ) : (
              <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center font-black text-primary-foreground text-3xl italic">G</div>
          )}
          <div className="flex flex-col">
              <span className="text-3xl font-black text-white tracking-tighter uppercase leading-none">{company?.tradeName || 'Go Motel'}</span>
              <span className="text-[10px] font-bold text-primary tracking-[0.4em] uppercase mt-1">Digital Menu Board</span>
          </div>
        </div>

        <div className="text-right bg-black/40 backdrop-blur-2xl p-5 px-10 rounded-[2rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-top-10 duration-1000">
          <p className="text-6xl font-black font-mono tracking-tighter text-primary leading-none">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.3em] mt-2">
            {format(now, "EEEE, d 'de' MMMM", { locale: es })}
          </p>
        </div>
      </div>

      {/* Main Feature: Estilo McDonald's Publicidad */}
      <div key={`info-${currentService.id}`} className="absolute bottom-0 left-0 w-full p-20 z-30">
        <div className="max-w-6xl space-y-6 animate-in fade-in slide-in-from-left-20 duration-1000 ease-out">
          <div className="inline-flex items-center gap-3 px-6 py-2.5 bg-primary rounded-full text-xs font-black uppercase tracking-[0.3em] text-primary-foreground shadow-2xl shadow-primary/40 mb-4 ring-4 ring-primary/20">
            <span className="animate-pulse">●</span> Recomendado: {currentService.category === 'Beverage' ? 'Bebidas' : currentService.category === 'Food' ? 'Comidas' : 'Amenidades'}
          </div>
          
          <h1 className="text-[9rem] font-black text-white uppercase tracking-tighter leading-[0.85] drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
            {currentService.name}
          </h1>
          
          <div className="flex items-end gap-12 pt-10">
            <div className="flex flex-col">
                <span className="text-xs font-black text-primary uppercase tracking-[0.5em] mb-2 ml-1">Precio Especial</span>
                <div className="text-[7rem] font-black text-white tracking-tighter drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] leading-none">
                    {formatCurrency(currentService.price)}
                </div>
            </div>
            {currentService.code && (
                <div className="mb-4 px-6 py-3 bg-white/5 backdrop-blur-3xl rounded-2xl border border-white/10 shadow-xl">
                    <span className="text-sm font-black text-white/40 uppercase tracking-[0.2em]">CÓDIGO REF: {currentService.code}</span>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline Progress Bar (Superior) */}
      <div className="absolute top-0 left-0 w-full h-2 bg-white/5 z-40">
        <div 
          className="h-full bg-primary transition-all duration-[8000ms] ease-linear shadow-[0_0_20px_hsl(var(--primary))]"
          style={{ width: `${((currentIndex + 1) / activeServices.length) * 100}%` }}
        />
      </div>

      {/* Overlay Animado para mayor dinamismo */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
          <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[150px] animate-pulse" />
          <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[150px] animate-pulse delay-700" />
      </div>

      <style jsx global>{`
        @keyframes ken-burns {
          0% { transform: scale(1.1); }
          100% { transform: scale(1.25); }
        }
        .animate-ken-burns {
          animation: ken-burns 15s ease-out infinite alternate;
        }
        body {
            background: black;
            cursor: none;
        }
      `}</style>
    </div>
  );
}
