'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Service, ProductCategory } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageIcon, MonitorPlay, QrCode } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const ROTATION_TIME = 15000; // 15 seconds

export default function PublicMenuDisplay() {
    const { firestore } = useFirebase();
    const [currentIndex, setCurrentStep] = useState(0);
    const [progress, setProgress] = useState(0);

    const categoriesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'productCategories'), orderBy('name')) : null, 
        [firestore]
    );
    const { data: categories, isLoading: isLoadingCategories } = useCollection<ProductCategory>(categoriesQuery);

    const servicesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'services'), where('isActive', '==', true)) : null, 
        [firestore]
    );
    const { data: services, isLoading: isLoadingServices } = useCollection<Service>(servicesQuery);

    const menuData = useMemo(() => {
        if (!categories || !services) return [];
        
        return categories.map(cat => ({
            category: cat,
            items: services.filter(s => s.categoryId === cat.id)
        })).filter(group => group.items.length > 0);
    }, [categories, services]);

    useEffect(() => {
        if (menuData.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentStep(prev => (prev + 1) % menuData.length);
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

    if (isLoadingCategories || isLoadingServices) {
        return (
            <div className="h-screen w-full bg-background flex flex-col p-12 gap-8 items-center justify-center">
                <Skeleton className="h-20 w-2/3" />
                <div className="grid grid-cols-2 w-full gap-12 flex-1">
                    <Skeleton className="h-full w-full rounded-3xl" />
                    <div className="space-y-6">
                        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                    </div>
                </div>
            </div>
        );
    }

    if (menuData.length === 0) {
        return (
            <div className="h-screen w-full bg-background flex flex-col items-center justify-center text-center p-12">
                <MonitorPlay className="h-24 w-24 text-muted-foreground mb-6 opacity-20" />
                <h1 className="text-4xl font-black uppercase tracking-tighter text-muted-foreground">Menú No Disponible</h1>
                <p className="text-xl text-muted-foreground/60 mt-2">No hay categorías o productos activos para mostrar.</p>
            </div>
        );
    }

    const currentGroup = menuData[currentIndex];
    const heroItem = currentGroup.items[0]; // First item as hero

    return (
        <div className="h-screen w-full bg-[#050505] text-white overflow-hidden flex flex-col relative select-none">
            {/* Top Progress Bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 z-50 bg-white/5">
                <div 
                    className="h-full bg-primary transition-all duration-100 ease-linear shadow-[0_0_15px_rgba(var(--primary),0.5)]" 
                    style={{ width: `${progress}%` }} 
                />
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Side: Visual Hero */}
                <div className="w-[45%] h-full relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#050505] z-10" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent z-10" />
                    
                    <img 
                        key={heroItem.id}
                        src={heroItem.imageUrl || `https://picsum.photos/seed/${heroItem.id}/1200/1200`} 
                        alt={heroItem.name}
                        className="h-full w-full object-cover animate-in fade-in zoom-in-110 duration-1000"
                        style={{ animation: 'ken-burns 20s infinite alternate' }}
                    />
                    
                    <div className="absolute bottom-16 left-12 right-12 space-y-4 z-10 animate-in slide-in-from-left-8 duration-700">
                        <Badge className="bg-primary text-white font-black px-4 py-1.5 rounded-none uppercase tracking-widest text-sm border-none">
                            Recomendación
                        </Badge>
                        <h2 className="text-6xl font-black uppercase tracking-tighter leading-none text-white drop-shadow-2xl">
                            {heroItem.name}
                        </h2>
                        <p className="text-xl text-white/70 font-medium line-clamp-3 max-w-lg italic">
                            {heroItem.description || "Disfruta de nuestra selección premium preparada con los mejores ingredientes."}
                        </p>
                    </div>
                </div>

                {/* Right Side: Menu List */}
                <div className="flex-1 flex flex-col p-16 relative">
                    <div className="mb-12 animate-in slide-in-from-top-8 duration-500">
                        <h1 className="text-[10rem] font-black uppercase tracking-tighter leading-[0.8] opacity-10 absolute -top-4 left-12 pointer-events-none">
                            {currentGroup.category.name}
                        </h1>
                        <div className="relative z-10">
                            <span className="text-primary font-black text-sm uppercase tracking-[0.4em] mb-2 block">Categoría</span>
                            <h2 className="text-7xl font-black uppercase tracking-tighter">{currentGroup.category.name}</h2>
                        </div>
                    </div>

                    <div className="flex-1 grid gap-y-6 items-start content-start">
                        {currentGroup.items.map((item, idx) => (
                            <div 
                                key={item.id} 
                                className="flex items-center justify-between group/item border-b border-white/5 pb-4 animate-in fade-in slide-in-from-right-8 duration-500"
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                <div className="flex items-center gap-6">
                                    <div className="h-16 w-16 rounded-2xl overflow-hidden bg-white/5 border border-white/10 shrink-0">
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center">
                                                <ImageIcon className="h-6 w-6 text-white/20" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-3xl font-black uppercase tracking-tight group-hover/item:text-primary transition-colors">
                                            {item.name}
                                        </h3>
                                        {item.description && (
                                            <p className="text-sm text-white/40 font-medium uppercase tracking-wider">{item.description}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-4xl font-black text-primary tracking-tighter">
                                        {formatCurrency(item.price)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer Info */}
                    <div className="mt-auto flex items-end justify-between border-t border-white/10 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        <div className="flex items-center gap-6">
                            <div className="bg-white p-3 rounded-2xl shadow-xl shadow-white/5">
                                <QrCode className="h-16 w-16 text-black" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-black uppercase tracking-widest text-primary">Menú Digital</p>
                                <p className="text-xl font-bold tracking-tight">Escanea para ver en tu móvil</p>
                                <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">Go Motel Manager Premium</p>
                            </div>
                        </div>
                        <div className="text-right opacity-30">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Sincronizado en tiempo real</p>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @keyframes ken-burns {
                    0% { transform: scale(1); }
                    100% { transform: scale(1.15); }
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
