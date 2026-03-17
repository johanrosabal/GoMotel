
'use client';

import { useState, useEffect } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Service, CompanyProfile } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { Utensils, Beer, Star, Clock } from 'lucide-react';

export default function PublicMenuClient() {
    const { firestore } = useFirebase();
    const [currentIndex, setCurrentTypeIndex] = useState(0);
    const [currentTime, setCurrentTime] = useState(new Date());
    const categories = ['Food', 'Beverage'];

    const servicesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'services'), where('isActive', '==', true));
    }, [firestore]);

    const { data: allServices } = useCollection<Service>(servicesQuery);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!allServices || allServices.length === 0) return;
        const interval = setInterval(() => {
            setCurrentTypeIndex((prev) => (prev + 1) % categories.length);
        }, 8000); // Rotación cada 8 segundos
        return () => clearInterval(interval);
    }, [allServices]);

    const currentType = categories[currentIndex];
    const filteredServices = allServices?.filter(s => s.category === currentType).slice(0, 6) || [];
    const highlightedProduct = filteredServices[0];

    if (!allServices) return <div className="h-screen bg-black flex items-center justify-center text-white font-black text-4xl animate-pulse uppercase tracking-[0.3em]">Cargando Menú...</div>;

    return (
        <div className="h-screen w-full bg-[#0a0a0a] text-white overflow-hidden flex flex-col font-sans select-none">
            {/* Header Publicitario */}
            <div className="h-24 bg-gradient-to-b from-primary/20 to-transparent border-b border-white/5 flex items-center justify-between px-12 shrink-0">
                <div className="flex items-center gap-6">
                    <div className="h-14 w-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                        <Utensils className="h-8 w-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black uppercase tracking-tighter leading-none italic">
                            Delicias <span className="text-primary">Gourmet</span>
                        </h1>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em] mt-1">Experiencia Gastronómica Exclusiva</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-8">
                    <div className="text-right">
                        <p className="text-3xl font-black tabular-nums tracking-tighter">{format(currentTime, 'HH:mm')}</p>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{format(currentTime, 'EEEE dd MMMM', { locale: es })}</p>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden relative">
                <AnimatePresence mode="wait">
                    <motion.div 
                        key={currentType}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.8, ease: "circOut" }}
                        className="w-full flex h-full p-12 gap-12"
                    >
                        {/* Left: Featured Product (Cinematic Look) */}
                        <div className="w-[45%] h-full relative rounded-[3rem] overflow-hidden shadow-2xl border border-white/5 group">
                            {highlightedProduct?.imageUrl ? (
                                <motion.img 
                                    key={highlightedProduct.id}
                                    initial={{ scale: 1.2 }}
                                    animate={{ scale: 1 }}
                                    transition={{ duration: 10 }}
                                    src={highlightedProduct.imageUrl} 
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="h-full w-full bg-gradient-to-br from-primary/40 to-black flex items-center justify-center">
                                    <Utensils className="h-32 w-32 opacity-10" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                            <div className="absolute bottom-12 left-12 right-12 space-y-4">
                                <Badge className="bg-primary text-white font-black px-4 py-1 text-xs uppercase tracking-widest mb-2">Recomendado</Badge>
                                <h2 className="text-6xl font-black uppercase tracking-tighter leading-[0.9] drop-shadow-2xl">
                                    {highlightedProduct?.name}
                                </h2>
                                <p className="text-xl text-white/70 font-medium line-clamp-2 max-w-md">
                                    {highlightedProduct?.description || "Preparado con ingredientes frescos del día para su deleite."}
                                </p>
                                <div className="text-5xl font-black text-primary tracking-tighter mt-4">
                                    {formatCurrency(highlightedProduct?.price || 0)}
                                </div>
                            </div>
                        </div>

                        {/* Right: Menu List */}
                        <div className="flex-1 flex flex-col justify-center space-y-10 pl-6">
                            <div className="flex items-center gap-4 mb-4">
                                {currentType === 'Food' ? <Utensils className="h-10 w-10 text-primary" /> : <Beer className="h-10 w-10 text-primary" />}
                                <h3 className="text-5xl font-black uppercase tracking-tighter">
                                    {currentType === 'Food' ? 'Nuestra Cocina' : 'Bar & Bebidas'}
                                </h3>
                            </div>

                            <div className="space-y-8">
                                {filteredServices.map((s, idx) => (
                                    <motion.div 
                                        key={s.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="flex justify-between items-end border-b border-white/10 pb-4 group"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl font-black uppercase tracking-tight group-hover:text-primary transition-colors">{s.name}</span>
                                                {idx === 0 && <Star className="h-4 w-4 fill-primary text-primary animate-pulse" />}
                                            </div>
                                            <p className="text-sm text-white/40 uppercase font-bold tracking-widest">{s.description || 'Especialidad de la casa'}</p>
                                        </div>
                                        <div className="text-3xl font-black tabular-nums tracking-tighter text-primary/90">
                                            {formatCurrency(s.price)}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            <div className="pt-12">
                                <div className="bg-white/5 rounded-3xl p-8 border border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-6">
                                        <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                                            <Clock className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Servicio a la habitación</p>
                                            <p className="text-xl font-bold uppercase">Disponible 24/7</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Marque a extensión</p>
                                        <p className="text-3xl font-black tracking-tighter">100</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Footer / Progress Bar */}
            <div className="h-2 bg-white/5 w-full">
                <motion.div 
                    key={currentType}
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 8, ease: "linear" }}
                    className="h-full bg-primary"
                />
            </div>
        </div>
    );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors", className)}>
            {children}
        </span>
    );
}
