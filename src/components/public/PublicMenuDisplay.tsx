'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Service, ProductCategory } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';

export default function PublicMenuDisplay() {
    const { firestore } = useFirebase();
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [qrUrl, setQrUrl] = useState<string>('');

    // Fetch data
    const categoriesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, [firestore]);
    const { data: categories, isLoading: isLoadingCategories } = useCollection<ProductCategory>(categoriesQuery);

    const servicesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'services'), orderBy('name')) : null, [firestore]);
    const { data: services, isLoading: isLoadingServices } = useCollection<Service>(servicesQuery);

    // Flatten data into slides: Each slide is a product showcase
    const slides = useMemo(() => {
        if (!categories || !services) return [];
        
        const activeServices = services.filter(s => s.isActive !== false);
        const result: { product: Service; category: ProductCategory; siblings: Service[] }[] = [];

        categories.forEach(cat => {
            const catProducts = activeServices.filter(s => s.categoryId === cat.id);
            // Only add slides if category has products
            catProducts.forEach(prod => {
                result.push({
                    product: prod,
                    category: cat,
                    siblings: catProducts
                });
            });
        });

        return result;
    }, [categories, services]);

    // Handle Rotation
    useEffect(() => {
        if (slides.length <= 1) return;

        const intervalTime = 10000; // 10 seconds per product
        const stepTime = 100;
        const totalSteps = intervalTime / stepTime;
        let currentStep = 0;

        const timer = setInterval(() => {
            currentStep++;
            setProgress((currentStep / totalSteps) * 100);

            if (currentStep >= totalSteps) {
                currentStep = 0;
                setCurrentSlideIndex(prev => (prev + 1) % slides.length);
            }
        }, stepTime);

        return () => clearInterval(timer);
    }, [slides.length]);

    // Set QR URL on client side
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setQrUrl(window.location.href);
        }
    }, []);

    if (isLoadingCategories || isLoadingServices) {
        return (
            <div className="h-screen w-full bg-black flex items-center justify-center">
                <div className="space-y-4 w-1/2">
                    <Skeleton className="h-12 w-3/4 bg-zinc-800" />
                    <Skeleton className="h-64 w-full bg-zinc-800" />
                </div>
            </div>
        );
    }

    if (slides.length === 0) {
        return (
            <div className="h-screen w-full bg-black flex flex-col items-center justify-center text-white space-y-4 text-center p-10">
                <h1 className="text-4xl font-black uppercase tracking-tighter">Menú No Disponible</h1>
                <p className="text-zinc-500 max-w-md">No hay productos activos o categorías configuradas para mostrar en este momento.</p>
            </div>
        );
    }

    const currentSlide = slides[currentSlideIndex];
    const { product, category, siblings } = currentSlide;

    // Determine if we should use 2 columns for the list on the right
    const useTwoColumns = siblings.length > 6;

    return (
        <div className="h-screen w-full bg-[#050505] text-white flex overflow-hidden font-sans select-none">
            {/* Left Side: Hero Image & Featured Product */}
            <div className="relative w-[60%] h-full overflow-hidden border-r border-zinc-800/50">
                {/* Background Image with Ken Burns effect */}
                <div key={`bg-${product.id}`} className="absolute inset-0 animate-in fade-in duration-1000">
                    <img 
                        src={product.imageUrl || `https://picsum.photos/seed/${product.id}/1200/800`} 
                        alt={product.name}
                        className="w-full h-full object-cover opacity-60 scale-110 animate-ken-burns"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/40 via-transparent to-transparent" />
                </div>

                {/* Progress Bar */}
                <div className="absolute top-0 left-0 right-0 h-1.5 z-50 bg-white/5">
                    <div 
                        className="h-full bg-primary transition-all duration-100 ease-linear shadow-[0_0_15px_rgba(var(--primary),0.5)]" 
                        style={{ width: `${progress}%` }} 
                    />
                </div>

                {/* Featured Product Info */}
                <div key={`info-${product.id}`} className="absolute bottom-16 left-12 right-12 space-y-4 z-10 animate-in slide-in-from-left-8 duration-700">
                    <Badge className="bg-primary text-white font-black px-4 py-1.5 rounded-none uppercase tracking-widest text-sm border-none shadow-lg">
                        RECOMENDADO: {category.name}
                    </Badge>
                    <div className="space-y-2">
                        <h2 className="text-7xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl">
                            {product.name}
                        </h2>
                        {product.description && (
                            <p className="text-xl text-zinc-300 font-medium max-w-2xl leading-relaxed drop-shadow-md italic">
                                {product.description}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Side: Category List */}
            <div className="w-[40%] h-full flex flex-col bg-[#0a0a0a] relative">
                <div className="p-12 space-y-10 flex-1 overflow-hidden">
                    <div className="space-y-1">
                        <p className="text-primary font-black uppercase tracking-[0.3em] text-xs">Menú de Servicios</p>
                        <h1 className="text-6xl font-black uppercase tracking-tighter text-white">{category.name}</h1>
                    </div>

                    <div className={cn(
                        "grid gap-x-8 gap-y-4",
                        useTwoColumns ? "grid-cols-2" : "grid-cols-1"
                    )}>
                        {siblings.map((item) => {
                            const isCurrent = item.id === product.id;
                            return (
                                <div 
                                    key={item.id} 
                                    className={cn(
                                        "flex justify-between items-start transition-all duration-500 py-3 border-b border-white/5",
                                        isCurrent ? "opacity-100 scale-105" : "opacity-30"
                                    )}
                                >
                                    <div className="space-y-1 flex-1 pr-4">
                                        <div className="flex items-center gap-2">
                                            {isCurrent && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                                            <p className={cn(
                                                "font-black text-lg uppercase tracking-tight leading-none transition-colors",
                                                isCurrent ? "text-primary" : "text-white"
                                            )}>
                                                {item.name}
                                            </p>
                                        </div>
                                        <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Ref: {item.code || '---'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn(
                                            "font-black text-xl tracking-tighter transition-colors",
                                            isCurrent ? "text-primary" : "text-zinc-400"
                                        )}>
                                            {formatCurrency(item.price)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer with QR */}
                <div className="p-12 pt-0 mt-auto shrink-0">
                    <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl flex items-center gap-6 backdrop-blur-sm shadow-2xl">
                        <div className="bg-white p-2 rounded-2xl shrink-0 shadow-2xl">
                            {qrUrl ? (
                                <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrUrl)}`}
                                    alt="QR Menu"
                                    className="w-[100px] h-[100px]"
                                />
                            ) : (
                                <div className="w-[100px] h-[100px] bg-zinc-200 animate-pulse rounded-lg" />
                            )}
                        </div>
                        <div className="space-y-1">
                            <p className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-[10px]">
                                <span className="w-2 h-2 rounded-full bg-primary animate-ping" /> Escanea y Ordena
                            </p>
                            <p className="text-[11px] text-zinc-400 font-bold uppercase leading-tight max-w-[200px]">
                                Escanea este código para ver el menú completo y precios actualizados en tu móvil.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @keyframes kenburns {
                    0% { transform: scale(1); }
                    100% { transform: scale(1.15); }
                }
                .animate-ken-burns {
                    animation: kenburns 20s linear infinite alternate;
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
