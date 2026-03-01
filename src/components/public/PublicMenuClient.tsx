
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service, ProductCategory, CompanyProfile } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Clock, Tag, Zap, Utensils, Beer, Sparkles } from 'lucide-react';
import { useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';

const CATEGORY_ICONS: Record<string, any> = {
  'Food': Utensils,
  'Beverage': Beer,
  'Amenity': Sparkles
};

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [now, setNow] = useState(new Date());
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  // Data Fetching
  const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companyInfo', 'main') : null, [firestore]);
  const { data: company } = useDoc<CompanyProfile>(companyRef);

  const servicesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'services'), where('isActive', '==', true), orderBy('category')) : null, 
    [firestore]
  );
  const { data: services } = useCollection<Service>(servicesQuery);

  // Group services by accounting category
  const groupedServices = useMemo(() => {
    if (!services) return {};
    return services.reduce((acc, s) => {
      if (!acc[s.category]) acc[s.category] = [];
      acc[s.category].push(s);
      return acc;
    }, {} as Record<string, Service[]>);
  }, [services]);

  const categories = useMemo(() => Object.keys(groupedServices), [groupedServices]);

  // Clock Update
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-Cycle Categories (Menu Board Logic)
  useEffect(() => {
    if (categories.length <= 1) return;

    const cycleTimer = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentCategoryIndex((prev) => (prev + 1) % categories.length);
        setIsVisible(true);
      }, 800); // Wait for fade out animation
    }, 10000); // Rotate every 10 seconds

    return () => clearInterval(cycleTimer);
  }, [categories]);

  if (!services || categories.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <Zap className="h-12 w-12 text-primary animate-pulse" />
          <p className="text-xl font-black uppercase tracking-widest animate-pulse">Cargando Menú Board...</p>
        </div>
      </div>
    );
  }

  const currentCategory = categories[currentCategoryIndex];
  const currentItems = groupedServices[currentCategory];
  const Icon = CATEGORY_ICONS[currentCategory] || Tag;

  const categoryLabels: Record<string, string> = {
    'Food': 'Nuestra Cocina',
    'Beverage': 'Bebidas y Licores',
    'Amenity': 'Complementos'
  };

  return (
    <div className="h-screen w-full bg-zinc-950 overflow-hidden flex flex-col relative text-white select-none">
      {/* Background Decorative Element */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(20,20,30,1)_0%,rgba(0,0,0,1)_100%)] z-0" />
      
      {/* Header Board */}
      <header className="relative z-10 px-12 py-8 flex justify-between items-center border-b border-white/5 bg-black/20 backdrop-blur-xl">
        <div className="flex items-center gap-6">
          {company?.logoUrl ? (
            <img src={company.logoUrl} alt="Logo" className="h-16 w-16 object-contain" />
          ) : (
            <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center">
              <Zap className="h-10 w-10 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase leading-none">
              {company?.tradeName || 'Go Motel'}
            </h1>
            <p className="text-primary font-black text-xs uppercase tracking-[0.4em] mt-1 flex items-center gap-2">
              <Icon className="h-3 w-3" /> {categoryLabels[currentCategory] || currentCategory}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-6xl font-black font-mono tracking-tighter text-white tabular-nums leading-none">
            {now.getHours().toString().padStart(2, '0')}:
            {now.getMinutes().toString().padStart(2, '0')}
          </p>
          <p className="text-xs font-black text-primary uppercase tracking-widest mt-2 bg-primary/10 px-3 py-1 rounded-full border border-primary/20 inline-block">
            {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </header>

      {/* Main Board Area */}
      <main className="flex-1 relative z-10 p-12 overflow-hidden">
        <div className={cn(
          "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 h-full transition-all duration-700 ease-in-out",
          isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-10 scale-95"
        )}>
          {currentItems.map((item, idx) => (
            <div 
              key={item.id} 
              className={cn(
                "relative group bg-zinc-900 rounded-[2rem] overflow-hidden border-2 border-white/5 shadow-2xl transition-all duration-500",
                "animate-in fade-in zoom-in-95"
              )}
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              {/* Product Image */}
              <div className="absolute inset-0 z-0">
                <img 
                  src={item.imageUrl || `https://picsum.photos/seed/${item.id}/800/800`} 
                  alt={item.name} 
                  className="w-full h-full object-cover transition-transform duration-[10s] ease-linear group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
              </div>

              {/* Top Reference Badge */}
              <div className="absolute top-6 left-6 z-20">
                <div className="px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-[10px] font-black font-mono tracking-widest text-primary uppercase">
                  REF: {item.code || 'N/A'}
                </div>
              </div>

              {/* Bottom Info Area */}
              <div className="absolute inset-x-0 bottom-0 p-8 z-20 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-3xl font-black uppercase tracking-tighter leading-none drop-shadow-lg">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-sm text-zinc-300 font-medium line-clamp-1 opacity-80 italic">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Precio Especial</span>
                    <span className="text-4xl font-black tracking-tighter text-white drop-shadow-md">
                      {formatCurrency(item.price)}
                    </span>
                  </div>
                  
                  {/* Status Circle */}
                  <div className="h-12 w-12 rounded-full border-2 border-primary/30 flex items-center justify-center bg-primary/10 backdrop-blur-md">
                    <Zap className="h-6 w-6 text-primary fill-primary" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Progress Bar (McDonald's Style) */}
      <div className="absolute bottom-0 left-0 h-1.5 bg-primary/20 w-full z-20">
        <div 
          className="h-full bg-primary transition-all duration-[10000ms] ease-linear"
          style={{ width: isVisible ? '100%' : '0%' }}
        />
      </div>

      {/* Footer Branding */}
      <footer className="relative z-10 px-12 py-6 bg-black/40 backdrop-blur-md flex justify-between items-center text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
        <div className="flex items-center gap-8">
          <span className="flex items-center gap-2">
            <CheckCircle className="h-3 w-3 text-primary" /> Calidad Garantizada
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle className="h-3 w-3 text-primary" /> Servicio a la Habitación 24/7
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>Menú Board v2.0</span>
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        </div>
      </footer>
    </div>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
  );
}
