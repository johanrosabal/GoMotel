'use client';

import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service, ProductCategory } from '@/types';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { UtensilsCrossed, Zap, Info, Tag } from 'lucide-react';

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const categoriesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, 
    [firestore]
  );
  const { data: categories } = useCollection<ProductCategory>(categoriesQuery);

  const servicesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'services'), where('isActive', '==', true)) : null, 
    [firestore]
  );
  const { data: services, isLoading } = useCollection<Service>(servicesQuery);

  const filteredServices = useMemo(() => {
    if (!services) return [];
    if (!selectedCategoryId) return services;
    return services.filter(s => s.categoryId === selectedCategoryId);
  }, [services, selectedCategoryId]);

  if (isLoading) {
    return (
      <div className="p-8 space-y-8 animate-pulse">
        <div className="flex justify-between items-center">
          <Skeleton className="h-12 w-64 rounded-2xl" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header Estilizado */}
      <header className="p-8 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter uppercase flex items-center gap-3">
            <UtensilsCrossed className="h-8 w-8 text-primary" />
            Menú de Servicios
          </h1>
          <p className="text-muted-foreground font-medium uppercase tracking-[0.3em] text-[10px]">Experiencia Gastronómica & Confort</p>
        </div>

        {/* Filtros de Categoría */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={cn(
              "px-6 h-11 rounded-full font-black text-xs uppercase tracking-widest transition-all border-2",
              selectedCategoryId === null 
                ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105" 
                : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted"
            )}
          >
            Todos
          </button>
          {categories?.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={cn(
                "px-6 h-11 rounded-full font-black text-xs uppercase tracking-widest transition-all border-2 whitespace-nowrap",
                selectedCategoryId === cat.id 
                  ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105" 
                  : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>

      {/* Grid de Productos Principal */}
      <main className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8 pb-20">
          {filteredServices.map((service, index) => (
            <div 
              key={service.id}
              className="group relative aspect-[4/5] rounded-[2.5rem] overflow-hidden bg-muted shadow-2xl border-4 border-transparent hover:border-primary/20 transition-all duration-500 animate-in fade-in zoom-in-95"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Imagen de Fondo */}
              <img 
                src={service.imageUrl || `https://picsum.photos/seed/${service.id}/800/1000`} 
                alt={service.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />

              {/* Etiquetas Superiores */}
              <div className="absolute top-6 inset-x-6 flex justify-between items-start z-20">
                <div className="flex flex-col gap-2">
                  <Badge className="bg-background/90 backdrop-blur-md text-primary border-none font-black uppercase text-[10px] tracking-widest px-4 py-1.5 shadow-xl">
                    {categories?.find(c => c.id === service.categoryId)?.name || 'General'}
                  </Badge>
                  {service.source === 'Internal' && (
                    <Badge variant="outline" className="bg-primary text-white border-none font-black uppercase text-[8px] tracking-[0.2em] px-3 py-1 shadow-lg animate-pulse">
                      <Zap className="h-2.5 w-2.5 mr-1 fill-current" /> Especialidad
                    </Badge>
                  )}
                </div>
                
                {/* Precio Flotante */}
                <div className="bg-primary text-primary-foreground rounded-2xl p-3 shadow-2xl ring-4 ring-primary/10 animate-in slide-in-from-top-4 duration-700 delay-200">
                  <span className="text-xl font-black tracking-tighter">{formatCurrency(service.price)}</span>
                </div>
              </div>

              {/* Gradiente Protector Inferior */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent z-10" />

              {/* Información del Producto (Dentro de la imagen) */}
              <div className="absolute inset-x-0 bottom-0 p-8 z-20 space-y-4">
                <div className="space-y-1 transform transition-transform duration-500 group-hover:-translate-y-2">
                  <div className="flex items-center gap-2 text-primary/80 mb-1">
                    <Tag className="h-3 w-3" />
                    <span className="font-mono text-[10px] font-bold tracking-widest uppercase">Ref: {service.code || 'N/A'}</span>
                  </div>
                  <h3 className="text-2xl font-black text-white leading-tight uppercase tracking-tight drop-shadow-lg">
                    {service.name}
                  </h3>
                </div>

                {service.description && (
                  <p className="text-white/60 text-xs font-medium leading-relaxed line-clamp-2 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
                    {service.description}
                  </p>
                )}

                {/* Línea Decorativa */}
                <div className="h-1.5 w-12 bg-primary rounded-full transition-all duration-500 group-hover:w-full opacity-50 group-hover:opacity-100" />
              </div>

              {/* Efecto de Brillo al Hover */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            </div>
          ))}
        </div>
      </main>

      {/* Footer / Info adicional */}
      <footer className="bg-muted/30 p-6 border-t flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Info className="h-4 w-4 text-primary" />
            Impuestos incluidos en todos los precios
          </div>
          <Separator orientation="vertical" className="h-4 bg-border" />
          <div className="text-[10px] font-medium text-muted-foreground italic">
            * Las imágenes son ilustrativas. La presentación puede variar.
          </div>
        </div>
        <div className="hidden md:block">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/50">Go Motel Digital Signage Experience</p>
        </div>
      </footer>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(var(--primary) / 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--primary) / 0.4);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

function Separator({ orientation = 'horizontal', className }: { orientation?: 'horizontal' | 'vertical', className?: string }) {
  return (
    <div className={cn(
      "shrink-0 bg-border",
      orientation === 'horizontal' ? "h-[1px] w-full" : "h-full w-[1px]",
      className
    )} />
  );
}
