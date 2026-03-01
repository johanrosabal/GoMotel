'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service, CompanyProfile } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [now, setNow] = useState(new Date());
  const [currentIndex, setCurrentIndex] = useState(0);

  // Data fetching
  const servicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'services'), where('isActive', '==', true), orderBy('category'));
  }, [firestore]);
  const { data: services } = useCollection<Service>(servicesQuery);

  const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companyInfo', 'main') : null, [firestore]);
  const { data: company } = useDoc<CompanyProfile>(companyRef);

  // Filter out Internal products (usually kitchen items without stock tracking but maybe we want to show them too)
  // For a Menu Board, we usually show everything that is active.
  const activeProducts = useMemo(() => services || [], [services]);

  // Slideshow logic
  useEffect(() => {
    if (activeProducts.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeProducts.length);
    }, 8000); // 8 seconds per product
    return () => clearInterval(interval);
  }, [activeProducts]);

  // Clock update
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!services || services.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black text-white">
        <p className="text-2xl font-black uppercase tracking-widest animate-pulse">Cargando Menú Board...</p>
      </div>
    );
  }

  const currentProduct = activeProducts[currentIndex];

  return (
    <div className="h-screen w-full bg-black overflow-hidden relative">
      {/* Background Image with Ken Burns Effect */}
      {activeProducts.map((product, index) => (
        <div 
          key={product.id}
          className={cn(
            "absolute inset-0 transition-opacity duration-1000 ease-in-out",
            index === currentIndex ? "opacity-100" : "opacity-0"
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-10" />
          <img 
            src={product.imageUrl || `https://picsum.photos/seed/${product.id}/1920/1080`}
            alt={product.name}
            className={cn(
              "w-full h-full object-cover transition-transform duration-[8000ms] ease-linear",
              index === currentIndex ? "scale-110" : "scale-100"
            )}
          />
        </div>
      ))}

      {/* Header: Logo and Clock */}
      <div className="absolute top-0 left-0 w-full p-12 z-20 flex justify-between items-start">
        <div className="flex items-center gap-6 bg-black/20 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
          {company?.logoUrl && <img src={company.logoUrl} alt="Logo" className="h-16 w-16 object-contain" />}
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter">
            {company?.tradeName || 'Go Motel'}
          </h2>
        </div>

        <div className="text-right bg-black/20 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
          <p className="text-6xl font-black font-mono tracking-tighter text-primary">
            {now.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </p>
          <p className="text-sm font-black text-white/60 uppercase tracking-[0.3em] mt-1">
            {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 w-full h-2 bg-white/5 z-30">
        <div 
          key={currentIndex}
          className="h-full bg-primary shadow-[0_0_20px_rgba(var(--primary),0.8)] animate-progress" 
          style={{ animationDuration: '8000ms' }}
        />
      </div>

      {/* Product Info Overlay */}
      <div className="absolute bottom-0 left-0 w-full p-20 z-20">
        <div className="max-w-[90%] space-y-6 animate-in fade-in slide-in-from-bottom-10 duration-1000">
          <Badge className="bg-primary text-black font-black text-xl px-6 py-2 uppercase tracking-[0.2em] rounded-full shadow-2xl">
            Recomendado: {currentProduct.category === 'Food' ? 'Comida' : currentProduct.category === 'Beverage' ? 'Bebida' : 'Amenidad'}
          </Badge>
          
          <div className="space-y-4">
            <h1 className="text-[7rem] font-black text-white uppercase tracking-tighter leading-[0.85] drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
              {currentProduct.name}
            </h1>
            
            <div className="flex items-center gap-8">
              <div className="bg-white text-black px-10 py-4 rounded-3xl shadow-2xl transform -rotate-2">
                <span className="text-7xl font-black tracking-tighter">
                  {formatCurrency(currentProduct.price)}
                </span>
              </div>
              
              {currentProduct.description && (
                <p className="text-2xl text-white/80 font-medium max-w-xl leading-snug drop-shadow-md">
                  {currentProduct.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        .animate-progress {
          animation-name: progress;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}

// Additional imports needed for the logic above
import { Badge } from '@/components/ui/badge';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useDoc } from '@/firebase';
