'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Service } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { Clock } from 'lucide-react';
import AppLogo from '@/components/AppLogo';
import Image from 'next/image';

export default function PublicMenuClient({ isDarkMode = false }: { isDarkMode?: boolean }) {
    const { firestore } = useFirebase();
    const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
    const [currentProductIndex, setCurrentProductIndex] = useState(0);
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

    const currentType = availableCategories[currentCategoryIndex] || 'Food';
    const filteredServices = useMemo(() => {
        return allServices?.filter(s => s.category === currentType) || [];
    }, [allServices, currentType]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Cycle products and categories using setTimeout to avoid stale closures
    useEffect(() => {
        if (filteredServices.length === 0) return;
        
        const timer = setTimeout(() => {
            if (currentProductIndex + 1 < filteredServices.length) {
                setCurrentProductIndex(currentProductIndex + 1);
            } else {
                // Switch to next category
                setCurrentCategoryIndex((prevCat) => (prevCat + 1) % availableCategories.length);
                setCurrentProductIndex(0);
            }
        }, 5000); // 5 seconds per product
        
        return () => clearTimeout(timer);
    }, [currentProductIndex, filteredServices, availableCategories]);

    // Auto scroll to active product
    useEffect(() => {
        const container = document.querySelector('.products-list-container');
        const activeItem = container?.querySelector('.is-active-product');
        if (activeItem) {
            activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentProductIndex]);

    const featuredProduct = filteredServices[currentProductIndex] || filteredServices[0];
    // Show all filtered services in the list, or a reasonable number that fits
    const listServices = filteredServices.slice(0, 10); 

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
        <div className="h-screen w-full overflow-hidden flex font-sans select-none relative bg-[#FDFBF7] text-[#1A1A1A]">
            <style>{`
                .scrollbar-none::-webkit-scrollbar { display: none; }
                .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            {/* Left Column: Featured Product (50%) */}
            <div className="w-1/2 h-full relative flex flex-col justify-between p-4 bg-[#FFFFFF]">
                {/* Logo and Branding */}
                <div className="flex items-center gap-4">
                    <div className="relative h-16 w-16">
                        <Image src="/logo_manolo.png" alt="Logo" fill className="object-contain" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-[#1A1A1A]">Hotel Du Manolo</h1>
                        <p className="text-xs font-bold uppercase tracking-widest text-[#7A756D]">Menu & Lounge</p>
                    </div>
                </div>

                {/* Featured Product Image */}
                <div className="flex-1 flex items-center justify-center relative my-4 overflow-hidden">
                    <AnimatePresence mode="wait">
                        {featuredProduct?.imageUrl ? (
                            <motion.img
                                key={featuredProduct.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.5 }}
                                src={featuredProduct.imageUrl}
                                className="max-h-[65vh] object-contain"
                                alt={featuredProduct.name}
                            />
                        ) : (
                            <div className="text-[#BAAFA0] text-lg font-medium">Selección Especial</div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Featured Product Info */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <span className="h-px w-8 bg-[#BAAFA0]"></span>
                        <span className="text-xs font-black uppercase tracking-[0.3em] text-[#BAAFA0]">Destacado del Día</span>
                    </div>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={featuredProduct?.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            <h2 className="text-4xl font-black uppercase italic tracking-tighter text-[#1A1A1A]">{featuredProduct?.name}</h2>
                            <p className="text-[#5C5751] font-medium text-lg max-w-xl">{featuredProduct?.description || "Una selección excepcional creada para deleitar sus sentidos."}</p>
                            <div className="text-4xl font-black text-[#D4AF37] italic mt-2">{formatCurrency(featuredProduct?.price || 0)}</div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Right Column: Menu List (50%) */}
            <div className="w-1/2 h-full flex flex-col justify-between p-8 bg-[#FDFBF7]">
                {/* Category Title */}
                <div className="border-b border-[#EADFCF] pb-4 mb-4">
                    <div className="text-xs font-black text-[#BAAFA0] uppercase tracking-[0.4em] mb-1">Sección</div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter italic text-[#1A1A1A] mb-2 break-words">
                        {categoryNames[currentType as keyof typeof categoryNames] || currentType}
                    </h3>
                </div>

                {/* Category Carousel (Tabs) */}
                <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
                    {availableCategories.map((cat, idx) => (
                        <div
                            key={cat}
                            className={cn(
                                "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                                idx === currentCategoryIndex
                                    ? "bg-[#D4AF37] text-white shadow-md scale-105"
                                    : "bg-white text-[#1A1A1A] border border-[#EADFCF] hover:bg-white/80"
                            )}
                            onClick={() => setCurrentCategoryIndex(idx)}
                        >
                            {categoryNames[cat as keyof typeof categoryNames] || cat}
                        </div>
                    ))}
                </div>

                {/* Items List */}
                <div className="flex-1 flex flex-col space-y-4 overflow-y-auto scrollbar-none products-list-container py-[25vh]" style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)', maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)' }}>
                    {listServices.map((s: Service, idx: number) => (
                        <motion.div
                            key={s.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 * idx, duration: 0.3 }}
                            className={cn(
                                "flex justify-between items-center group p-2 rounded-xl transition-all",
                                idx === currentProductIndex
                                    ? "bg-[#D4AF37]/10 border border-[#D4AF37]/30 shadow-sm is-active-product"
                                    : "border border-transparent hover:bg-white/50"
                            )}
                        >
                            <div className="flex items-center gap-4 max-w-[70%]">
                                <div className={cn(
                                    "relative h-12 w-12 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden bg-white transition-all",
                                    idx === currentProductIndex ? "border-[#D4AF37]" : "border-[#EADFCF]"
                                )}>
                                    {s.imageUrl ? (
                                        <img src={s.imageUrl} className="max-h-full object-contain" style={{ mixBlendMode: 'multiply' }} alt="" />
                                    ) : (
                                        <div className="text-[#BAAFA0] text-xs font-bold">MÉNU</div>
                                    )}
                                </div>
                                <div className="space-y-0.5">
                                    <span className={cn(
                                        "text-lg font-black uppercase tracking-tight block italic transition-colors",
                                        idx === currentProductIndex ? "text-[#D4AF37]" : "text-[#1A1A1A]"
                                    )}>
                                        {s.name}
                                    </span>
                                    <span className="text-xs font-medium text-[#7A756D] block truncate max-w-[250px]">{s.description || "Especialidad de la casa"}</span>
                                </div>
                            </div>
                            <div className="flex-1 border-b border-dotted border-[#EADFCF] mx-4 self-center mb-1"></div>
                            <div className={cn(
                                "text-lg font-black tabular-nums tracking-tighter transition-colors",
                                idx === currentProductIndex ? "text-[#D4AF37]" : "text-[#1A1A1A]"
                            )}>
                                {formatCurrency(s.price)}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Footer Info */}
                <div className="border-t border-[#EADFCF] pt-4 mt-4 flex justify-between items-center">
                    <div className="flex items-center gap-3 text-[#7A756D]">
                        <Clock className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">Disponible 24/7</span>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-black text-[#1A1A1A] tabular-nums tracking-tighter">{format(currentTime, 'HH:mm')}</div>
                        <div className="text-xs font-bold text-[#BAAFA0] uppercase tracking-widest">{format(currentTime, 'EEEE dd', { locale: es })}</div>
                    </div>
                </div>
            </div>

            {/* Progress Bar (Per Product) */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-[#EADFCF] z-50">
                <motion.div
                    key={featuredProduct?.id}
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 5, ease: "linear" }}
                    className="h-full bg-[#D4AF37]"
                />
            </div>
        </div>
    );
}
