'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Service, ProductCategory } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function PublicMenuDisplay() {
    const { firestore } = useFirebase();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const ROTATION_TIME = 15000; // 15 segundos por categoría

    const categoriesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, 
        [firestore]
    );
    const { data: categories, isLoading: isLoadingCats } = useCollection<ProductCategory>(categoriesQuery);

    const servicesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'services'), orderBy('name')) : null, 
        [firestore]
    );
    const { data: services, isLoading: isLoadingServices } = useCollection<Service>(servicesQuery);

    const menuData = useMemo(() => {
        if (!categories || !services) return [];
        return categories
            .map(cat => ({
                category: cat,
                products: services.filter(s => s.categoryId === cat.id && s.isActive !== false)
            }))
            .filter(item => item.products.length > 0);
    }, [categories, services]);

    useEffect(() => {
        if (menuData.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % menuData.length);
            setProgress(0);
        }, ROTATION_TIME);

        const progressInterval = setInterval(() => {
            setProgress(prev => Math.min(prev + (100 / (ROTATION_TIME / 100)), 100));
        }, 100);

        return () => {
            clearInterval(interval);
            clearInterval(progressInterval);
        };
    }, [menuData.length]);

    if (isLoadingCats || isLoadingServices) {
        return (
            <div className="h-screen w-full bg-[#0a0a0a] flex items-center justify-center p-12 gap-12">
                <Skeleton className="flex-1 h-full rounded-3xl bg-white/5" />
                <div className="w-[450px] h-full space-y-6">
                    <Skeleton className="h-20 w-full bg-white/5" />
                    <Skeleton className="h-full w-full bg-white/5" />
                </div>
            </div>
        );
    }

    if (menuData.length === 0) {
        return (
            <div className="h-screen w-full bg-[#0a0a0a] flex flex-col items-center justify-center text-white gap-4">
                <h1 className="text-4xl font-black uppercase tracking-widest text-primary">Menú Digital</h1>
                <p className="text-muted-foreground italic">No hay productos activos para mostrar en este momento.</p>
            </div>
        );
    }

    const currentItem = menuData[currentIndex];
    const featuredProduct = currentItem.products[0];
    
    // Generar URL para el QR basada en la ubicación actual
    const menuUrl = typeof window !== 'undefined' ? window.location.origin + '/public/menu' : '';
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(menuUrl)}&bgcolor=ffffff&color=000000&margin=10`;

    return (
        <div className="h-screen w-full bg-[#0a0a0a] text-white overflow-hidden flex flex-col relative select-none">
            {/* Barra de progreso superior */}
            <div className="absolute top-0 left-0 h-1.5 bg-primary/20 w-full z-50">
                <div 
                    className="h-full bg-primary transition-all duration-100 ease-linear"
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="flex-1 flex min-h-0">
                {/* Panel Izquierdo: Imagen Hero del Producto Estrella */}
                <div className="flex-1 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent z-10" />
                    <img 
                        key={featuredProduct.id}
                        src={featuredProduct.imageUrl || `https://picsum.photos/seed/${featuredProduct.id}/1200/1200`} 
                        alt={featuredProduct.name}
                        className="h-full w-full object-cover animate-ken-burns scale-110"
                    />
                    
                    <div className="absolute bottom-16 left-12 right-12 space-y-4 z-10 animate-in slide-in-from-left-8 duration-700">
                        <Badge className="bg-primary text-white font-black px-4 py-1.5 rounded-none uppercase tracking-widest text-sm border-none shadow-xl">
                            Recomendado: {currentItem.category.name}
                        </Badge>
                        <h2 className="text-7xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl">
                            {featuredProduct.name}
                        </h2>
                        <p className="text-2xl text-white/80 font-medium max-w-2xl line-clamp-2 drop-shadow-lg italic">
                            {featuredProduct.description || "Disfruta de nuestra selección premium preparada al instante para tu habitación."}
                        </p>
                    </div>
                </div>

                {/* Panel Derecho: Lista de Productos de la Categoría */}
                <div className="w-[550px] xl:w-[700px] bg-black/40 backdrop-blur-3xl border-l border-white/5 flex flex-col p-12 pb-28 relative overflow-hidden">
                    <div className="mb-12 space-y-2">
                        <h1 className="text-primary font-black text-xs uppercase tracking-[0.5em]">Menú de Servicios</h1>
                        <h3 className="text-6xl font-black uppercase tracking-tight text-white/90 truncate">{currentItem.category.name}</h3>
                    </div>

                    {/* Lista Dinámica: Se divide en 2 columnas si hay muchos productos */}
                    <div className={cn(
                        "grid gap-x-12 gap-y-8 flex-1 items-start content-start transition-all duration-500",
                        currentItem.products.length > 6 ? "grid-cols-2" : "grid-cols-1"
                    )}>
                        {currentItem.products.map((product, idx) => (
                            <div 
                                key={product.id} 
                                className="flex justify-between items-end border-b border-white/10 pb-4 group hover:border-primary/50 transition-colors animate-in fade-in slide-in-from-bottom-2 duration-500"
                                style={{ animationDelay: `${idx * 80}ms` }}
                            >
                                <div className="space-y-1 min-w-0 flex-1 pr-4">
                                    <p className="font-bold text-xl uppercase tracking-tight group-hover:text-primary transition-colors truncate">{product.name}</p>
                                    <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black">
                                        Ref: {product.code || 'SVC'}
                                    </p>
                                </div>
                                <p className="text-3xl font-black text-primary tracking-tighter shrink-0">
                                    {formatCurrency(product.price)}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Footer con QR Real */}
                    <div className="absolute bottom-8 left-12 right-12 flex items-center gap-6 bg-white/5 p-5 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl">
                        <div className="bg-white p-2 rounded-xl shrink-0 shadow-lg">
                            <img src={qrUrl} alt="QR Menú" className="w-24 h-24" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                <p className="text-sm font-black uppercase tracking-widest text-primary">Escanea y Ordena</p>
                            </div>
                            <p className="text-[11px] text-white/70 font-bold leading-tight uppercase max-w-[280px]">
                                Escanea este código para ver el menú completo y precios actualizados en tu móvil.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @keyframes kenburns {
                    0% { transform: scale(1.05); }
                    100% { transform: scale(1.2); }
                }
                .animate-ken-burns {
                    animation: kenburns 25s ease-in-out infinite alternate;
                }
                ::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </div>
    );
}
