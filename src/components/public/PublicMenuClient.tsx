
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
import Image from 'next/image';

export default function PublicMenuClient({ isDarkMode = false }: { isDarkMode?: boolean }) {
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
        <div className={cn("h-screen w-full overflow-hidden flex font-sans select-none relative transition-colors duration-1000", isDarkMode ? "bg-slate-950 text-slate-50" : "bg-slate-50 text-slate-900")}>
            {/* Background Layer: Fullscreen Ken Burns Image */}
            <AnimatePresence mode="wait">
                <motion.div 
                    key={featuredProduct?.id || currentType}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2 }}
                    className={cn("absolute top-0 bottom-0 left-0 z-0 transition-all duration-1000", listServices.length > 0 ? "w-[45%]" : "w-[50%]")}
                >
                    {featuredProduct?.imageUrl ? (
                        <>
                            <motion.img 
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                src={featuredProduct.imageUrl} 
                                className="h-full w-full object-contain opacity-100 py-32 px-16"
                                alt=""
                            />
                            <div className="absolute inset-0 pointer-events-none">
                                <div className={cn("absolute top-0 left-0 right-0 h-64", isDarkMode ? "bg-gradient-to-b from-slate-950 via-slate-950/90 to-transparent" : "bg-gradient-to-b from-slate-50 via-slate-50/90 to-transparent")} />
                                <div className={cn("absolute bottom-0 left-0 right-0 h-48", isDarkMode ? "bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent" : "bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent")} />
                                <div className={cn("absolute left-0 top-0 bottom-0 w-48", isDarkMode ? "bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" : "bg-gradient-to-r from-slate-50 via-slate-50/80 to-transparent")} />
                                <div className={cn("absolute right-0 top-0 bottom-0 w-48", isDarkMode ? "bg-gradient-to-l from-slate-950 via-slate-950/80 to-transparent" : "bg-gradient-to-l from-slate-50 via-slate-50/80 to-transparent")} />
                            </div>
                        </>
                    ) : (
                        <div className={cn("h-full w-full", isDarkMode ? "bg-gradient-to-br from-primary/20 via-slate-900 to-primary/5" : "bg-gradient-to-br from-primary/20 via-slate-100 to-primary/5")} />
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Top Bar: Name and Logos */}
            <div className="absolute top-12 left-0 right-0 z-50 px-24 flex justify-between items-center pointer-events-none">
                <div className="pointer-events-auto">
                    <div className="relative h-20 w-20">
                        <Image src="/logo_manolo.png" alt="Hotel Du Manolo Logo" fill className="object-contain drop-shadow-xl" />
                    </div>
                </div>
                <div className="pointer-events-auto">
                    <h1 className={cn("text-5xl font-black uppercase tracking-[0.3em] italic leading-none drop-shadow-xl transition-colors duration-1000", isDarkMode ? "text-slate-50" : "text-slate-900")}>
                        Hotel Du Manolo
                    </h1>
                </div>
                <div className="pointer-events-auto">
                    <div className="relative h-20 w-20">
                        <Image src="/logo_manolo.png" alt="Hotel Du Manolo Logo" fill className="object-contain drop-shadow-xl" />
                    </div>
                </div>
            </div>

            {/* Content Layer */}
            <div className="relative z-10 w-full h-full flex items-stretch pt-20">
                {/* Left empty spacer to reveal the background image */}
                <div className={cn("shrink-0 pointer-events-none transition-all duration-1000", listServices.length > 0 ? "w-[40%]" : "w-[50%]")} />

                {/* Text Info */}
                <div className={cn(
                    "flex-1 flex flex-col justify-center p-8 transition-all duration-1000 ease-in-out",
                    listServices.length > 0 ? "max-w-[30%]" : "pr-24"
                )}>
                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={featuredProduct?.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 1, delay: 0.5 }}
                            className="w-full h-full flex flex-col justify-center max-w-4xl"
                        >
                            <div className="flex items-center gap-4 transition-all duration-1000 mb-8 mt-12">
                                <div className="h-1 w-12 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]" />
                                <span className={cn(
                                    "font-black uppercase tracking-[0.5em] text-primary transition-all duration-1000",
                                    listServices.length === 0 ? "text-xl" : "text-sm"
                                )}>
                                    DESTACADO DEL DÍA
                                </span>
                            </div>

                            <div className="flex flex-col transition-all duration-1000 px-0 overflow-visible">
                                <h2 className={cn(
                                    "font-black leading-[0.95] tracking-tighter uppercase italic transition-all duration-1000 mb-8",
                                    listServices.length > 0 
                                        ? cn(isDarkMode ? "drop-shadow-[0_0_15px_rgba(0,0,0,0.8)]" : "text-slate-900 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]", "text-7xl") 
                                        : cn(isDarkMode ? "drop-shadow-[0_0_20px_rgba(0,0,0,0.9)]" : "drop-shadow-[0_0_20px_rgba(255,255,255,0.9)]", "text-[5vw] leading-[0.9] text-primary")
                                )}>
                                    {featuredProduct?.name}
                                </h2>
                            </div>

                            <div className="flex flex-col transition-all duration-1000">
                                <p className={cn(
                                    "font-bold leading-relaxed max-w-2xl transition-all duration-1000 border-l-4 border-primary/40 pl-8 mb-12",
                                    listServices.length > 0 ? "text-lg" : "text-xl",
                                    isDarkMode ? "text-slate-300 drop-shadow-[0_0_10px_rgba(0,0,0,1)]" : "text-slate-700 drop-shadow-[0_0_10px_rgba(255,255,255,1)]"
                                )}>
                                    {featuredProduct?.description || "Una selección excepcional creada para deleitar sus sentidos con los mejores ingredientes."}
                                </p>
                                <div className="flex">
                                    <div className={cn("inline-flex items-center gap-8 backdrop-blur-md p-2 rounded-[2.5rem] pr-12 shadow-xl transition-colors duration-1000", isDarkMode ? "bg-black/40 border border-white/5 shadow-black/40" : "bg-white/40 border border-black/5 shadow-black/5")}>
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
                        <div className="w-[30%] shrink-0 h-full py-12 pr-12 flex flex-col justify-center">
                            <motion.div 
                                initial={{ x: 100, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 100, opacity: 0 }}
                                transition={{ duration: 1.2, ease: "circOut" }}
                                className={cn("backdrop-blur-[40px] border rounded-[4rem] h-full flex flex-col overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.05)] transition-colors duration-1000", isDarkMode ? "bg-slate-900/80 border-white/5 shadow-[0_30px_60px_rgba(0,0,0,0.3)]" : "bg-white/80 border-black/5 shadow-[0_30px_60px_rgba(0,0,0,0.05)]")}
                            >
                        {/* Panel Header */}
                        <div className={cn("p-16 pb-8 flex items-center justify-between border-b transition-colors duration-1000", isDarkMode ? "border-white/5" : "border-black/5")}>
                            <div>
                                <div className="text-[10px] font-black text-primary uppercase tracking-[0.6em] mb-2 italic">Menú Gourmet</div>
                                <h3 className={cn("text-4xl font-black uppercase tracking-tighter italic transition-colors duration-1000", isDarkMode ? "text-slate-50" : "text-slate-900")}>
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
                                                    <span className={cn("text-2xl font-black uppercase tracking-tight group-hover:text-primary transition-colors duration-300 block italic", isDarkMode ? "text-slate-100" : "text-slate-800")}>{s.name}</span>
                                                    <span className={cn("text-xs font-bold uppercase tracking-[0.2em] block", isDarkMode ? "text-slate-500" : "text-slate-400")}>{s.description || "Especialidad"}</span>
                                                </div>
                                                <div className={cn("text-2xl font-black tabular-nums tracking-tighter group-hover:text-primary transition-colors duration-300", isDarkMode ? "text-slate-300" : "text-slate-600")}>
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
