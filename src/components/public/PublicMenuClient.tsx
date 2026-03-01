'use client';

import React, { useState, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service, ProductCategory } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [now, setNow] = useState(new Date());

  // Data fetching
  const servicesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'services'), where('isActive', '==', true), orderBy('name')) : null, 
    [firestore]
  );
  const { data: services, isLoading: isLoadingServices } = useCollection<Service>(servicesQuery);

  const categoriesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, 
    [firestore]
  );
  const { data: categories, isLoading: isLoadingCategories } = useCollection<ProductCategory>(categoriesQuery);

  // Clock update
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (isLoadingServices || isLoadingCategories) {
    return (
      <div className="min-h-screen bg-black p-12 grid grid-cols-3 gap-8">
        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-80 w-full rounded-3xl bg-zinc-900" />)}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-12 flex flex-col gap-12 overflow-hidden">
      {/* Header para TV */}
      <div className="flex items-center justify-between border-b border-white/10 pb-8">
        <div className="space-y-2">
          <h1 className="text-7xl font-black uppercase tracking-tighter text-primary animate-in slide-in-from-left duration-700">Menú de Servicios</h1>
          <p className="text-2xl text-zinc-500 font-bold uppercase tracking-[0.4em] ml-1">Experiencia Go Motel</p>
        </div>
        <div className="text-right bg-white/5 px-8 py-4 rounded-3xl border border-white/10 backdrop-blur-md">
          <p className="text-5xl font-black font-mono tracking-tighter text-primary">
            {now.toLocaleTimeString([], { hour: '2xl', minute: '2xl' })}
          </p>
          <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mt-1">
            {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Grid de Publicidad */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10 flex-1">
        {services?.map((service, index) => (
          <div 
            key={service.id}
            className="group relative h-[450px] rounded-[3rem] overflow-hidden border-4 border-zinc-900 bg-zinc-950 shadow-2xl shadow-black animate-in fade-in zoom-in duration-1000"
            style={{ animationDelay: `${index * 150}ms` }}
          >
            {/* Imagen de Producto */}
            <img 
              src={service.imageUrl || `https://picsum.photos/seed/${service.id}/800/1000`} 
              alt={service.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-[5000ms] group-hover:scale-110 opacity-90"
            />

            {/* Capas de degradado para legibilidad */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent opacity-50" />

            {/* Badge de Categoría superior */}
            <div className="absolute top-8 left-8">
              <div className="bg-primary/90 backdrop-blur-xl text-white font-black text-[10px] uppercase tracking-widest px-5 py-2 rounded-full border border-white/20 shadow-lg">
                {categories?.find(c => c.id === service.categoryId)?.name || 'Recomendado'}
              </div>
            </div>

            {/* Información Inferior Integrada */}
            <div className="absolute bottom-0 left-0 right-0 p-8 pt-20 bg-gradient-to-t from-black to-transparent">
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono font-bold text-primary/80 tracking-tighter bg-primary/10 px-2 py-0.5 rounded border border-primary/20 italic">
                      REF: {service.code}
                    </span>
                  </div>
                  <h2 className="text-4xl font-black uppercase tracking-tight leading-[0.9] drop-shadow-2xl">
                    {service.name}
                  </h2>
                </div>
                
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl px-6 py-3 shadow-inner">
                    <p className="text-3xl font-black tracking-tighter text-white">
                      {formatCurrency(service.price)}
                    </p>
                  </div>
                  {service.source === 'Internal' && (
                    <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer para TV */}
      <div className="mt-auto pt-8 border-t border-white/5 flex justify-between items-center text-zinc-600">
        <p className="text-xs font-black uppercase tracking-[0.6em] animate-pulse italic">
          Ordene ahora mismo escaneando el código QR de su habitación
        </p>
        <p className="text-xs font-bold uppercase tracking-widest opacity-50">Go Motel Manager v2.0</p>
      </div>
    </div>
  );
}
