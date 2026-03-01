'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { Service, ProductCategory } from '@/types';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, cn } from '@/lib/utils';
import { Utensils, Beer, Sparkles, Star } from 'lucide-react';

interface PublicMenuDisplayProps {
    services: Service[];
    categories: ProductCategory[];
}

export default function PublicMenuDisplay({ services, categories }: PublicMenuDisplayProps) {
    const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const ROTATION_TIME = 15000; // 15 segundos por categoría

    const menuData = useMemo(() => {
        return categories
            .map(cat => ({
                category: cat,
                products: services.filter(s => s.categoryId === cat.id && s.isActive !== false)
            }))
            .filter(item => item.products.length > 0);
    }, [services, categories]);

    useEffect(() => {
        if (menuData.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentCategoryIndex((prev) => (prev + 1) % menuData.length);
            setProgress(0);
        }, ROTATION_TIME);

        const progressInterval = setInterval(() => {
            setProgress((prev) => Math.min(prev + (100 / (ROTATION_TIME / 100)), 100));
        }, 100);

        return () => {
            clearInterval(interval);
            clearInterval(progressInterval);
        };
    }, [menuData.length]);

    if (menuData.length === 0) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-zinc-950 text-white font-black uppercase tracking-widest text-2xl">
                Cargando Menú...
            </div>
        );
    }

    const currentData = menuData[currentCategoryIndex];
    const featuredProduct = currentData.products[0];
    const qrUrl = typeof window !== 'undefined' ? window.location.href : '';

    return (
        <div className="h-screen w-full bg-zinc-950 text-white overflow-hidden flex flex-col relative select-none">
            {/* Top Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5 z-50">
                <div 
                    className="h-full bg-primary transition-all duration-100 ease-linear shadow-[0_0_15px_rgba(16,185,129,0.5)]" 
                    style={{ width: `${progress}%` }} 
                />
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Side: Visual Impact */}
                <div className="w-[45%] h-full relative overflow-hidden border-r border-white/5 shadow-2xl">
                    <div className="absolute inset-0 z-10 bg-gradient-to-r from-transparent via-transparent to-zinc-950" />
                    <div className="absolute inset-0 z-10 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent" />
                    
                    {/* Animated Background Image */}
                    <img 
                        key={featuredProduct.id}
                        src={featuredProduct.imageUrl || "https://picsum.photos/seed/menu/1200/1600"} 
                        alt={featuredProduct.name}
                        className="absolute inset-0 object-cover w-full h-full animate-ken-burns opacity-60"
                    />

                    <div className="absolute top-16 left-12 z-20 space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="h-1 w-12 bg-primary rounded-full" />
                            <span className="text-primary font-black uppercase tracking-[0.4em] text-sm italic">Especialidad</span>
                        </div>
                    </div>
                    
                    <div className="absolute bottom-16 left-12 right-12 space-y-4 z-10 animate-in slide-in-from-left-8 duration-700">
                        <Badge className="bg-primary text-white font-black px-4 py-1.5 rounded-none uppercase tracking-widest text-sm border-none">
                            Recomendación
                        </Badge>
                        <h2 className="text-6xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl">
                            {featuredProduct.name}
                        </h2>
                        <div className="h-1 w-24 bg-white/20" />
                        <p className="text-xl font-bold text-white/60 max-w-md line-clamp-3 italic">
                            {featuredProduct.description || "Descubre el sabor inigualable de nuestra selección premium preparada al momento."}
                        </p>
                    </div>
                </div>

                {/* Right Side: Product Listing */}
                <div className="flex-1 h-full flex flex-col p-16 lg:p-20 relative bg-zinc-950/50 backdrop-blur-sm">
                    {/* Header */}
                    <div className="mb-12 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                                {currentData.category.name.toLowerCase().includes('bebida') ? <Beer className="h-8 w-8 text-primary" /> : <Utensils className="h-8 w-8 text-primary" />}
                            </div>
                            <h1 className="text-7xl font-black uppercase tracking-tighter text-white">
                                {currentData.category.name}
                            </h1>
                        </div>
                        <p className="text-lg text-white/40 font-bold uppercase tracking-[0.3em] ml-2">Nuestra Selección Premium</p>
                    </div>

                    {/* Products Grid - Two columns if many items */}
                    <div className={cn(
                        "grid gap-x-12 gap-y-8 flex-1 content-start animate-in fade-in zoom-in-95 duration-700 delay-200",
                        currentData.products.length > 6 ? "grid-cols-2" : "grid-cols-1"
                    )}>
                        {currentData.products.map((product, idx) => (
                            <div 
                                key={product.id} 
                                className="flex items-center justify-between group border-b border-white/5 pb-4 hover:border-primary/30 transition-colors"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <span className="text-zinc-800 font-black text-2xl group-hover:text-primary/20 transition-colors">{(idx + 1).toString().padStart(2, '0')}</span>
                                        <h3 className="text-2xl font-black uppercase tracking-tight text-white group-hover:text-primary transition-colors">
                                            {product.name}
                                        </h3>
                                        {idx === 0 && <Star className="h-4 w-4 text-primary fill-primary animate-pulse" />}
                                    </div>
                                    <p className="text-sm text-white/30 font-medium ml-10 italic">{product.description || "Calidad y frescura garantizada."}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-3xl font-black text-primary tracking-tighter">
                                        {formatCurrency(product.price)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer Info / QR */}
                    <div className="mt-auto pt-12 flex items-end justify-between border-t border-white/5">
                        <div className="flex items-center gap-6 bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-2xl">
                            <div className="bg-white p-2 rounded-xl shadow-inner">
                                <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}&bgcolor=ffffff&color=000000&margin=1`} 
                                    alt="Menú QR"
                                    className="h-20 w-20"
                                />
                            </div>
                            <div className="space-y-1">
                                <p className="text-primary font-black text-[10px] uppercase tracking-[0.2em]">Menú Digital</p>
                                <p className="text-2xl font-black text-white leading-none">Escanea para ver en tu móvil</p>
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Go Motel Manager Premium</p>
                            </div>
                        </div>

                        <div className="text-right space-y-1">
                            <p className="text-4xl font-black tracking-tighter text-white/20 uppercase">Go Motel</p>
                            <p className="text-[10px] font-bold text-white/10 uppercase tracking-[0.5em]">Experiencia Exclusiva</p>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @keyframes ken-burns {
                    0% { transform: scale(1); }
                    100% { transform: scale(1.15); }
                }
                .animate-ken-burns {
                    animation: ken-burns 20s ease-out infinite alternate;
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
