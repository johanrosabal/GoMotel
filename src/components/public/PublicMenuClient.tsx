'use client';

import { useState, useEffect } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function PublicMenuClient() {
  const { firestore } = useFirebase();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [now, setNow] = useState(new Date());

  const servicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'services'),
      where('isActive', '==', true),
      orderBy('name')
    );
  }, [firestore]);

  const { data: services, isLoading } = useCollection<Service>(servicesQuery);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (services && services.length > 0) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % services.length);
      }, 8000); // Rota cada 8 segundos
      return () => clearInterval(interval);
    }
  }, [services]);

  if (isLoading || !services || services.length === 0) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black">
        <div className="text-white font-black text-2xl animate-pulse uppercase tracking-[0.3em]">
          Cargando Menú...
        </div>
      </div>
    );
  }

  const currentProduct = services[currentIndex];

  return (
    <div className="h-screen w-screen relative bg-black select-none cursor-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentProduct.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {/* Fondo de Imagen con Efecto Zoom Suave */}
          <motion.div 
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 8, ease: "linear" }}
            className="absolute inset-0"
          >
            <img 
              src={currentProduct.imageUrl || 'https://picsum.photos/seed/menu/1920/1080'} 
              alt={currentProduct.name}
              className="w-full h-full object-cover opacity-60 grayscale-[20%]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
          </motion.div>

          {/* Contenido Informativo Gigante */}
          <div className="absolute inset-0 flex flex-col justify-end p-20 pb-32">
            <motion.div
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="max-w-[80%]"
            >
              <span className="inline-block px-6 py-2 bg-primary text-primary-foreground font-black text-2xl uppercase tracking-[0.3em] mb-8 rounded-full shadow-2xl">
                {currentProduct.category === 'Food' ? 'Deliciosa Comida' : 'Bebida Refrescante'}
              </span>
              <h1 className="text-[7rem] lg:text-[9rem] font-black text-white leading-none uppercase tracking-tighter drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)]">
                {currentProduct.name}
              </h1>
              <div className="flex items-center gap-12 mt-10">
                <div className="text-8xl font-black text-primary drop-shadow-2xl">
                  {formatCurrency(currentProduct.price)}
                </div>
                <div className="h-20 w-1 bg-white/20" />
                <div className="max-w-xl">
                  <p className="text-2xl text-white/80 font-bold leading-tight italic">
                    {currentProduct.description || "Pregunta a nuestro personal por los ingredientes especiales de este platillo."}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Reloj y Logo Superior */}
      <div className="absolute top-12 left-20 right-20 flex justify-between items-center z-20">
        <div className="flex items-center gap-6">
          <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center shadow-2xl">
            <Flame className="h-10 w-10 text-white" />
          </div>
          <div className="text-white">
            <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">Go Motel</h2>
            <p className="text-primary font-black uppercase tracking-[0.2em] text-sm mt-1">Digital Menu Board</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 bg-black/40 backdrop-blur-2xl px-8 py-4 rounded-3xl border-2 border-white/10 shadow-2xl">
          <Clock className="h-8 w-8 text-primary" />
          <span className="text-5xl font-black text-white tabular-nums tracking-tighter">
            {now.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Barra de Progreso Inferior */}
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-white/5 overflow-hidden">
        <motion.div 
          key={currentIndex}
          initial={{ x: '-100%' }}
          animate={{ x: '0%' }}
          transition={{ duration: 8, ease: "linear" }}
          className="h-full bg-primary shadow-[0_0_20px_rgba(var(--primary),0.5)]"
        />
      </div>
    </div>
  );
}

function Flame(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}