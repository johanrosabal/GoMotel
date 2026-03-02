
'use client';

import React, { useState, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function PublicMenuClient() {
    const { firestore } = useFirebase();
    const [currentIndex, setCurrentSetIndex] = useState(0);

    const servicesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'services'), where('isActive', '==', true), orderBy('price', 'desc')) : null, 
        [firestore]
    );
    const { data: allServices } = useCollection<Service>(servicesQuery);

    // Filter out services without images for the TV board
    const promotionalServices = allServices?.filter(s => s.imageUrl) || [];

    useEffect(() => {
        if (promotionalServices.length === 0) return;
        const interval = setInterval(() => {
            setCurrentSetIndex((prev) => (prev + 1) % promotionalServices.length);
        }, 8000); // 8 seconds per slide
        return () => clearInterval(interval);
    }, [promotionalServices.length]);

    if (!allServices || promotionalServices.length === 0) {
        return <div className="min-h-screen bg-black flex items-center justify-center text-white font-black text-4xl uppercase tracking-widest">Cargando Menú...</div>;
    }

    const currentService = promotionalServices[currentIndex];

    return (
        <div className="h-screen w-screen bg-black overflow-hidden relative font-sans text-white">
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentService.id}
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="absolute inset-0"
                >
                    {/* Background Fullscreen Image */}
                    <div className="absolute inset-0">
                        <Avatar className="h-full w-full rounded-none">
                            <AvatarImage src={currentService.imageUrl} className="object-cover" />
                            <AvatarFallback className="bg-zinc-900 rounded-none">
                                <ImageIcon className="h-20 w-20 opacity-10" />
                            </AvatarFallback>
                        </Avatar>
                        {/* Overlay Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
                    </div>

                    {/* Content Overlay */}
                    <div className="relative h-full flex flex-col justify-center px-20 max-w-5xl space-y-8">
                        <motion.div
                            initial={{ x: -100, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.5, duration: 0.8 }}
                            className="space-y-4"
                        >
                            <span className="inline-block px-6 py-2 bg-primary text-white font-black text-xl uppercase tracking-[0.3em] rounded-full">
                                {currentService.category === 'Food' ? 'Nuestra Cocina' : 'Desde la Barra'}
                            </span>
                            <h1 className="text-[7.5rem] leading-[0.85] font-black uppercase tracking-tighter drop-shadow-2xl italic">
                                {currentService.name}
                            </h1>
                        </motion.div>

                        <motion.div
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 1, duration: 0.8 }}
                            className="flex items-center gap-12"
                        >
                            <div className="flex flex-col">
                                <span className="text-2xl font-black text-primary uppercase tracking-widest opacity-80">Precio Especial</span>
                                <span className="text-[9rem] font-black leading-none tracking-tighter tabular-nums drop-shadow-2xl">
                                    {formatCurrency(currentService.price)}
                                </span>
                            </div>
                        </motion.div>

                        {currentService.description && (
                            <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 1.5, duration: 1 }}
                                className="text-3xl text-zinc-300 font-bold max-w-2xl leading-tight italic opacity-80"
                            >
                                "{currentService.description}"
                            </motion.p>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Sidebar with Set Menu (Simple List) */}
            <div className="absolute right-0 top-0 bottom-0 w-[400px] bg-black/60 backdrop-blur-3xl border-l border-white/10 p-12 flex flex-col">
                <div className="flex justify-between items-center mb-12">
                    <h2 className="text-2xl font-black uppercase tracking-widest border-b-4 border-primary pb-2">Menú del Día</h2>
                    <div className="text-right">
                        <p className="text-4xl font-black font-mono">
                            {new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>
                
                <div className="flex-1 space-y-8">
                    {allServices.slice(0, 8).map(s => (
                        <div key={s.id} className={cn(
                            "flex justify-between items-start transition-all duration-500",
                            s.id === currentService.id ? "scale-110 text-primary translate-x-[-10px]" : "opacity-40"
                        )}>
                            <div className="max-w-[200px]">
                                <p className="font-black text-xl uppercase leading-none tracking-tight">{s.name}</p>
                                <p className="text-xs font-bold uppercase opacity-60 mt-1">{s.category === 'Food' ? 'Cocina' : 'Bar'}</p>
                            </div>
                            <span className="font-black text-2xl tabular-nums">{formatCurrency(s.price)}</span>
                        </div>
                    ))}
                </div>

                <div className="mt-auto pt-12 border-t border-white/10 text-center">
                    <p className="text-sm font-black uppercase tracking-[0.3em] opacity-40">Go Motel - Room Service</p>
                </div>
            </div>
        </div>
    );
}
