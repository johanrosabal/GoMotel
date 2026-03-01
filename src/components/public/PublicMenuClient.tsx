'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service, ProductCategory } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { ImageIcon, Clock, Star, Zap } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const SLIDE_DURATION = 8000; // 8 seconds per slide

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const servicesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'services'), where('isActive', '==', true)) : null, 
    [firestore]
  );
  const { data: services, isLoading } = useCollection<Service>(servicesQuery);

  const featuredServices = useMemo(() => {
    if (!services) return [];
    // Only show products with images for high impact
    return services.filter(s => !!s.imageUrl);
  }, [services]);

  useEffect(() => {
    if (featuredServices.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % featuredServices.length);
      setProgress(0);
    }, SLIDE_DURATION);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + (100 / (SLIDE_DURATION / 100)), 100));
    }, 100);

    return () => {
      clearInterval(interval);
      clearInterval(progressInterval);
    };
  }, [featuredServices.length]);

  if (isLoading || featuredServices.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-20 w-20 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white font-black uppercase tracking-widest animate-pulse">Cargando Menú Board...</p>
        </div>
      </div>
    );
  }

  const currentService = featuredServices[currentIndex];

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none cursor-none">
      {/* Top Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 z-50 bg-white/10">
        <div 
          className="h-full bg-primary transition-all duration-100 ease-linear shadow-[0_0_20px_rgba(var(--primary),0.5)]" 
          style={{ width: `${progress}%` }} 
        />
      </div>

      {/* Main Slide */}
      <div className="absolute inset-0 transition-opacity duration-1000">
        <img 
          key={currentService.id}
          src={currentService.imageUrl} 
          alt={currentService.name}
          className="w-full h-full object-cover animate-ken-burns"
        />
        
        {/* Cinematic Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />

        {/* Content Area */}
        <div className="absolute inset-x-0 bottom-0 p-24 z-20 flex flex-col justify-end min-h-screen">
          <div className="max-w-[90%] space-y-10 animate-in slide-in-from-left-10 duration-1000">
            
            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <Badge className="bg-primary text-white h-12 px-8 text-xl font-black uppercase tracking-[0.3em] rounded-full border-0 shadow-2xl">
                        {currentService.category === 'Food' ? 'Comida' : currentService.category === 'Beverage' ? 'Bebida' : 'Servicio'}
                    </Badge>
                    <div className="flex items-center gap-2 text-yellow-400">
                        <Star className="h-8 w-8 fill-current" />
                        <span className="text-2xl font-black uppercase tracking-widest text-white/80">RECOMENDADO</span>
                    </div>
                </div>
                
                <h1 className="text-[7rem] font-black text-white uppercase tracking-tighter leading-[0.85] drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
                    {currentService.name}
                </h1>
            </div>

            <div className="flex items-center gap-12">
                <div className="bg-white/10 backdrop-blur-2xl border-2 border-white/20 px-12 py-6 rounded-[3rem] shadow-2xl inline-block">
                    <p className="text-7xl font-black text-white font-mono tracking-tighter">
                        {formatCurrency(currentService.price)}
                    </p>
                </div>
                <div className="flex flex-col gap-2">
                    <p className="text-2xl font-black text-primary uppercase tracking-widest flex items-center gap-3">
                        <Zap className="h-8 w-8 fill-current" /> Pídelo desde tu mesa
                    </p>
                    <p className="text-xl text-white/60 font-medium">Escanea el código QR y ordena al instante</p>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Info (Clock & Logo) */}
      <div className="absolute top-12 right-12 z-50 flex items-center gap-8">
        <div className="text-right bg-black/40 backdrop-blur-2xl px-10 py-6 rounded-[2.5rem] border-2 border-white/10 shadow-2xl">
          <p className="text-6xl font-black font-mono tracking-tighter text-white leading-none mb-1">
            {now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </p>
          <p className="text-sm font-black text-primary uppercase tracking-[0.4em] ml-1">
            {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Background Music Hint or Extra Branding */}
      <div className="absolute bottom-12 right-12 z-50">
        <div className="bg-primary h-24 w-24 rounded-full flex items-center justify-center shadow-2xl shadow-primary/40 border-4 border-white/20 animate-pulse">
            <Smartphone className="h-10 w-10 text-white" />
        </div>
      </div>

      <style jsx global>{`
        @keyframes kenburns {
          0% { transform: scale(1); }
          100% { transform: scale(1.15); }
        }
        .animate-ken-burns {
          animation: kenburns ${SLIDE_DURATION + 1000}ms ease-out forwards;
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
