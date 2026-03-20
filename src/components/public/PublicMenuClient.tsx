
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Service, CompanyProfile } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { Utensils, Beer, Star, Clock, QrCode } from 'lucide-react';
import AppLogo from '@/components/AppLogo';

export default function PublicMenuClient() {
    const { firestore } = useFirebase();
    const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [origin, setOrigin] = useState('');

    useEffect(() => {
        setOrigin(window.location.origin);
    }, []);

    const servicesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'products'), 
            where('isActive', '==', true),
            where('isPublic', '==', true)
        );
    }, [firestore]);

    const { data: allServices } = useCollection<Service>(servicesQuery);

    const availableCategories = useMemo(() => {
        if (!allServices) return [];
        const cats = Array.from(new Set(allServices.map(s => s.category)));
        return cats.sort((a, b) => {
            if (a === 'Food') return -1;
            if (b === 'Food') return 1;
            return a.localeCompare(b);
        });
    }, [allServices]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (availableCategories.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentCategoryIndex((prev) => (prev + 1) % availableCategories.length);
        }, 15000); // 15 seconds per category for a relaxed look
        return () => clearInterval(interval);
    }, [availableCategories]);

    const currentType = availableCategories[currentCategoryIndex] || 'Food';
    const filteredServices = allServices?.filter(s => s.category === currentType) || [];
    const featuredProduct = filteredServices.find(s => s.imageUrl) || filteredServices[0];
    const listServices = filteredServices.filter(s => s.id !== featuredProduct?.id).slice(0, 7);

    if (!allServices) {
        return (
            <div className="h-screen bg-black flex items-center justify-center">
                <div className="relative">
                    <motion.div 
                        animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        className="h-32 w-32 border-2 border-primary/30 rounded-full blur-md"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <AppLogo className="h-10 w-10 text-primary animate-pulse" />
                    </div>
                </div>
            </div>
        );
    }

    const categoryNames = {
        'Food': 'Gastronomía',
        'Beverage': 'Bebidas & Coctelería',
        'Amenity': 'Servicios Especiales'
    };

    return (
        <div className="h-screen w-full bg-slate-50 text-slate-900 overflow-hidden flex font-sans select-none relative">
            {/* Background Layer: Fullscreen Ken Burns Image */}
            <AnimatePresence mode="wait">
                <motion.div 
                    key={featuredProduct?.id || currentType}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2 }}
                    className="absolute inset-0 z-0"
                >
                    {featuredProduct?.imageUrl ? (
                        <motion.img 
                            initial={{ scale: 1, x: 0 }}
                            animate={{ scale: 1.15, x: -20, y: -10 }}
                            transition={{ duration: 20, ease: "linear" }}
                            src={featuredProduct.imageUrl} 
                            className="h-full w-full object-cover opacity-60"
                            alt=""
                        />
                    ) : (
                        <div className="h-full w-full bg-gradient-to-br from-primary/20 via-slate-100 to-primary/5" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-white via-white/40 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-t from-white/20 via-transparent to-white/10" />
                </motion.div>
            </AnimatePresence>

            {/* Content Layer */}
            <div className="relative z-10 w-full h-full flex items-stretch">
                {/* Left: Featured Product Info */}
                <div className={cn(
                    "flex flex-col justify-end p-24 pb-32 transition-all duration-1000 ease-in-out",
                    listServices.length > 0 ? "w-[60%]" : "w-full items-center text-center"
                )}>
                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={featuredProduct?.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 1, delay: 0.5 }}
                            className={cn(
                                "w-full h-full flex flex-col transition-all duration-1000",
                                listServices.length === 0 ? "justify-between max-w-none" : "justify-end max-w-3xl"
                            )}
                        >
                            <div className={cn(
                                "flex items-center gap-4 transition-all duration-1000",
                                listServices.length === 0 ? "justify-center mt-8" : "mb-8"
                            )}>
                                <div className="h-1 w-12 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]" />
                                <span className={cn(
                                    "font-black uppercase tracking-[0.5em] text-primary transition-all duration-1000",
                                    listServices.length === 0 ? "text-2xl" : "text-sm"
                                )}>
                                    DESTACADO DEL DÍA
                                </span>
                                <div className={cn("h-1 w-12 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]", listServices.length > 0 && "hidden")} />
                            </div>

                            <div className={cn(
                                "flex flex-col transition-all duration-1000 px-12 overflow-visible",
                                listServices.length === 0 ? "flex-1 justify-center" : ""
                            )}>
                                <h2 className={cn(
                                    "font-black leading-[0.9] tracking-tighter uppercase italic text-slate-900 transition-all duration-1000",
                                    listServices.length > 0 
                                        ? "text-8xl mb-8" 
                                        : "text-[8vw] whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-primary via-slate-900 to-primary drop-shadow-[0_20px_40px_rgba(0,0,0,0.1)] py-4"
                                )}>
                                    {featuredProduct?.name}
                                </h2>
                            </div>

                            <div className={cn(
                                "flex flex-col transition-all duration-1000",
                                listServices.length === 0 ? "mb-12" : ""
                            )}>
                                <p className={cn(
                                    "text-xl font-medium text-slate-600 leading-relaxed mb-12 max-w-2xl transition-all duration-1000",
                                    listServices.length > 0 ? "border-l-4 border-primary/40 pl-8" : "mx-auto text-2xl"
                                )}>
                                    {featuredProduct?.description || "Una selección excepcional creada para deleitar sus sentidos con los mejores ingredientes."}
                                </p>
                                <div className={cn("flex", listServices.length === 0 ? "justify-center" : "")}>
                                    <div className="inline-flex items-center gap-8 bg-white/40 backdrop-blur-md border border-black/5 p-2 rounded-[2.5rem] pr-12 shadow-xl shadow-black/5">
                                        <div className="bg-primary text-white px-10 py-6 rounded-[2rem] text-5xl font-black italic tracking-tighter shadow-lg shadow-primary/20">
                                            {formatCurrency(featuredProduct?.price || 0)}
                                        </div>
                                        <div className="flex flex-col text-left">
                                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Precio Final</span>
                                            <span className="text-sm font-bold text-primary italic uppercase tracking-widest">Incluye Impuestos</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Right: Floating Menu Panel */}
                <AnimatePresence>
                    {listServices.length > 0 && (
                        <div className="w-[40%] h-full p-12 pr-16 flex flex-col justify-center">
                            <motion.div 
                                initial={{ x: 100, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 100, opacity: 0 }}
                                transition={{ duration: 1.2, ease: "circOut" }}
                                className="bg-white/80 backdrop-blur-[40px] border border-black/5 rounded-[4rem] h-full flex flex-col overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.05)]"
                            >
                        {/* Panel Header */}
                        <div className="p-16 pb-8 flex items-center justify-between border-b border-black/5">
                            <div>
                                <div className="text-[10px] font-black text-primary uppercase tracking-[0.6em] mb-2 italic">Menú Gourmet</div>
                                <h3 className="text-4xl font-black uppercase tracking-tighter italic text-slate-900">
                                    {categoryNames[currentType as keyof typeof categoryNames] || currentType}
                                </h3>
                            </div>
                            <AppLogo className="h-10 w-10 text-primary opacity-20" />
                        </div>

                        {/* List Items */}
                        <div className="flex-1 p-16 space-y-12 overflow-hidden">
                            <AnimatePresence mode="wait">
                                <motion.div 
                                    key={currentType}
                                    className="space-y-10"
                                >
                                    {listServices.length > 0 ? (
                                        listServices.map((s: Service, idx: number) => (
                                            <motion.div 
                                                key={s.id}
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.1 * idx, duration: 0.8 }}
                                                className="flex justify-between items-start group"
                                            >
                                                <div className="space-y-1">
                                                    <span className="text-2xl font-black uppercase tracking-tight text-slate-800 group-hover:text-primary transition-colors duration-300 block italic">{s.name}</span>
                                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] block">{s.description || "Especialidad"}</span>
                                                </div>
                                                <div className="text-2xl font-black tabular-nums tracking-tighter text-slate-600 group-hover:text-primary transition-colors">
                                                    {formatCurrency(s.price)}
                                                </div>
                                            </motion.div>
                                        ))
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center pt-8 opacity-10">
                                            <Star className="h-24 w-24 text-primary" />
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Panel Footer - LIGHT THEME */}
                        <div className="p-16 pt-8 border-t border-black/5 bg-slate-50/50">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <Clock className="h-5 w-5 text-primary" />
                                    <span className="text-sm font-black uppercase tracking-widest text-slate-400">Disponible 24/7</span>
                                </div>
                                <div className="text-right leading-none">
                                    <div className="text-[32px] font-black tabular-nums tracking-tighter text-slate-900">{format(currentTime, 'HH:mm')}</div>
                                    <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-1">{format(currentTime, 'EEEE dd', { locale: es })}</div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-8 bg-primary rounded-[2.5rem] text-white shadow-xl shadow-primary/20 border-t border-white/20">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest leading-none text-white/60 mb-1">Pedido Directo</span>
                                    <span className="text-xl font-black uppercase italic leading-none">Llamar Habitación</span>
                                </div>
                                <div className="text-4xl font-black italic tracking-tighter">Ext. 100</div>
                            </div>
                        </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom Global Progress Bar */}
            <div className="absolute bottom-0 left-0 w-full h-2 bg-slate-200 z-50">
                <motion.div 
                    key={currentType}
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 15, ease: "linear" }}
                    className="h-full bg-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]"
                />
            </div>
        </div>
    );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <span className={cn("inline-flex items-center rounded-full px-4 py-1.5 text-xs font-black transition-colors", className)}>
            {children}
        </span>
    );
}
