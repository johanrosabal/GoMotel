'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Service, ProductCategory } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { ImageIcon, Clock, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function PublicMenuClient() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const qS = query(collection(db, 'services'), orderBy('name'));
    const unsubS = onSnapshot(qS, (snap) => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
    });

    const qC = query(collection(db, 'productCategories'), orderBy('name'));
    const unsubC = onSnapshot(qC, (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductCategory)));
    });

    return () => {
      unsubS();
      unsubC();
    };
  }, []);

  const activeServices = services.filter(s => s.isActive);
  const groupedServices = categories.map(cat => ({
    ...cat,
    items: activeServices.filter(s => s.categoryId === cat.id)
  })).filter(group => group.items.length > 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-10 lg:p-16 space-y-16 overflow-x-hidden">
      {/* Header Diseñado para TV */}
      <div className="flex justify-between items-center border-b-4 border-primary pb-10">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="h-12 w-3 bg-primary rounded-full animate-pulse" />
            <h1 className="text-7xl lg:text-8xl font-black tracking-tighter uppercase text-white">
              Menú <span className="text-primary italic">Digital</span>
            </h1>
          </div>
          <p className="text-2xl text-zinc-500 font-bold uppercase tracking-[0.4em] ml-16">Go Motel Experience</p>
        </div>
        
        {/* Reloj Digital Premium */}
        <div className="text-right bg-white/5 px-12 py-8 rounded-[3rem] border-2 border-white/10 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <p className="text-7xl font-black font-mono tracking-tighter text-primary">
            {now.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </p>
          <p className="text-sm font-black text-zinc-400 uppercase tracking-[0.3em] mt-3 flex items-center justify-end gap-3">
            <Clock className="h-5 w-5 text-primary" />
            {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Secciones de Menú */}
      <div className="space-y-32 pb-20">
        {groupedServices.map((category, catIdx) => (
          <div key={category.id} className="space-y-12 animate-in fade-in slide-in-from-bottom-12 duration-1000" style={{ animationDelay: `${catIdx * 300}ms` }}>
            <div className="flex items-center gap-8">
              <h2 className="text-5xl font-black uppercase tracking-[0.2em] text-white/90 bg-white/5 px-8 py-3 rounded-2xl border border-white/10">{category.name}</h2>
              <div className="h-1 flex-1 bg-gradient-to-r from-primary to-transparent opacity-30" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
              {category.items.map((item, itemIdx) => (
                <div 
                  key={item.id} 
                  className="group relative aspect-[3/4] rounded-[3rem] overflow-hidden border-4 border-white/5 bg-zinc-900 shadow-2xl transition-all duration-700 hover:scale-[1.03] hover:border-primary/50"
                >
                  {/* Imagen de Fondo */}
                  {item.imageUrl ? (
                    <img 
                      src={item.imageUrl} 
                      alt={item.name} 
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-90"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                      <ImageIcon className="h-24 w-24 text-zinc-700" />
                    </div>
                  )}

                  {/* Capas de degradado para legibilidad publicitaria */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />

                  {/* Badge de Referencia (Arriba) */}
                  <div className="absolute top-8 left-8">
                    <div className="bg-black/60 backdrop-blur-xl border border-white/20 px-4 py-1.5 rounded-full shadow-xl">
                      <p className="text-[10px] font-black tracking-[0.2em] text-primary uppercase">REF: {item.code || 'P000'}</p>
                    </div>
                  </div>

                  {/* Contenido del Producto (Abajo) */}
                  <div className="absolute inset-x-0 bottom-0 p-10 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-4xl font-black uppercase tracking-tight leading-[0.9] text-white group-hover:text-primary transition-colors duration-300">
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="text-zinc-400 text-sm font-bold line-clamp-2 uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                          {item.description}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between pt-6 border-t-2 border-white/10">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Precio Final</span>
                        <span className="text-5xl font-black text-white tracking-tighter drop-shadow-lg">
                          {formatCurrency(item.price)}
                        </span>
                      </div>
                      <div className="h-16 w-16 rounded-3xl bg-primary text-primary-foreground flex items-center justify-center shadow-[0_0_30px_rgba(var(--primary),0.4)] animate-bounce duration-1000">
                        <Zap className="h-8 w-8 fill-current" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Branding TV */}
      <div className="pt-24 border-t border-white/5 flex justify-between items-center opacity-30">
        <p className="text-2xl font-black uppercase tracking-[1em]">Publicidad Digital</p>
        <div className="flex items-center gap-4">
            <span className="h-3 w-3 rounded-full bg-primary animate-ping" />
            <p className="text-xl font-bold uppercase tracking-widest">Actualizado en tiempo real</p>
        </div>
      </div>
    </div>
  );
}